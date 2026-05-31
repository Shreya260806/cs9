import Answer from '../models/answer.model.js'
import Comment from '../models/comment.model.js'
import Notification from '../models/notification.model.js'
import Question from '../models/question.model.js'
import User from '../models/user.model.js'
import UserProfile from '../models/user-profile.model.js'
import Vote from '../models/vote.model.js'
import { awardSpark, reserveBounty } from '../services/spark.service.js'
import {
  createHttpError,
  escapeRegex,
  getPagination,
  paginationResult,
} from '../utils/http.js'

function slugifyTag(tag) {
  return String(tag)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general'
}

function normalizeTags(tags) {
  const cleanedTags = Array.isArray(tags)
    ? tags.map((tag) => String(tag).trim()).filter(Boolean)
    : []

  return cleanedTags.length > 0 ? cleanedTags : ['General']
}

const GENERIC_FAQ_TAGS = new Set(['faq', 'internship', 'vins'])

function getFaqTags(faq) {
  const tags = normalizeTags(faq.tags)
  return tags.filter((tag) => !GENERIC_FAQ_TAGS.has(tag.toLowerCase()))
}

async function getDisplayNameByUserId(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))]

  if (!ids.length) {
    return {}
  }

  const [users, profiles] = await Promise.all([
    User.find({ user_id: { $in: ids } }).select('user_id name').lean(),
    UserProfile.find({ user_id: { $in: ids } }).select('user_id display_name').lean(),
  ])
  const displayNameById = Object.fromEntries(users.map((u) => [u.user_id, u.name]))

  for (const profile of profiles) {
    if (profile.display_name) {
      displayNameById[profile.user_id] = profile.display_name
    }
  }

  return displayNameById
}

export async function listPublishedFAQs(req, res, next) {
  try {
    const faqs = await Question.find({
      kind: 'faq',
      status: 'published',
      visibility: 'public',
    })
      .sort({ is_pinned: -1, title: 1 })
      .lean()

    const groupedByTag = new Map()

    for (const faq of faqs) {
      const tags = getFaqTags(faq)
      const item = {
        id: faq.question_id,
        question: faq.title,
        answer: faq.body,
        tags,
        updatedAt: faq.updated_at,
      }

      for (const tag of tags) {
        const tagId = slugifyTag(tag)

        if (!groupedByTag.has(tagId)) {
          groupedByTag.set(tagId, {
            id: tagId,
            label: tag,
            faqs: [],
          })
        }

        groupedByTag.get(tagId).faqs.push(item)
      }
    }

    const tags = Array.from(groupedByTag.values())
    const grouped = Object.fromEntries(tags.map((tag) => [tag.label, tag.faqs]))

    res.json({ success: true, tags, faqs: grouped, total: faqs.length })
  } catch (error) {
    next(error)
  }
}

function isAdmin(req) {
  return req.user.roles.includes('ADMIN')
}

/**
 * Returns real User.name for each user ID, bypassing any UserProfile display_name
 * overrides. Admins always see real names, never "Anonymous".
 */
async function getRealNameByUserId(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return {}
  const users = await User.find({ user_id: { $in: ids } }).select('user_id name').lean()
  return Object.fromEntries(users.map((u) => [u.user_id, u.name || 'Unknown']))
}

function canManage(req, question) {
  return isAdmin(req) || question.author_id === req.user.userId
}

export function getQuestionStatusFilter(status) {
  if (status === 'open') {
    return { $in: ['unanswered', 'answered'] }
  }
  if (status === 'resolved') {
    return 'closed'
  }
  return status || undefined
}

export async function createQuestion(req, res, next) {
  let question

  try {
    const sparkBounty = Number(req.body.sparkBounty || 0)

    if (!Number.isInteger(sparkBounty) || sparkBounty < 0) {
      throw createHttpError(400, 'Spark bounty must be a non-negative integer')
    }

    question = await Question.create({
      title: req.body.title,
      body: req.body.body,
      tags: req.body.tags,
      spark_bounty: sparkBounty,
      is_anonymous: req.body.isAnonymous === true,
      author_id: req.user.userId,
    })

    await reserveBounty(req.user.userId, sparkBounty, question.question_id)
    await awardSpark({
      userId: req.user.userId,
      action: 'SUBMIT_QUESTION',
      referenceId: question.question_id,
      referenceType: 'question',
    })

    res.status(201).json({
      success: true,
      questionId: question.question_id,
      message: 'Question created',
    })
  } catch (error) {
    if (question && error.statusCode === 403) {
      await Question.deleteOne({ question_id: question.question_id })
    }
    next(error)
  }
}

export async function listQuestions(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query)
    const filter = {}

    if (req.query.kind) {
      filter.kind = req.query.kind
    }

    if (req.query.tag) {
      // Selected categories filter over tags (comma-separated → match any)
      const tags = String(req.query.tag).split(',').map((t) => t.trim()).filter(Boolean)
      if (tags.length) {
        filter.tags = tags.length > 1 ? { $in: tags } : tags[0]
      }
    }
    const statusFilter = getQuestionStatusFilter(req.query.status)
    if (statusFilter) {
      filter.status = statusFilter
    }
    if (req.query.search) {
      // Keyword search over question text (title/body) and answer text
      const search = new RegExp(escapeRegex(String(req.query.search)), 'i')
      const answerQuestionIds = await Answer.find({ body: search }).distinct('question_id')
      filter.$or = [
        { title: search },
        { body: search },
        { question_id: { $in: answerQuestionIds } },
      ]
    }
    if (req.query.createdAfter) {
      const since = new Date(req.query.createdAfter)
      if (!Number.isNaN(since.getTime())) {
        filter.created_at = { $gte: since }
      }
    }

    // Support ?my=1 to fetch only the current user's questions
    if (req.query.my === '1') {
      filter.author_id = req.user.userId
    }

    if (req.query.id) {
      filter.question_id = req.query.id
    }

    if (!isAdmin(req)) {
      filter.moderation_status = 'approved'
      if (filter.status === 'removed') {
        filter.status = { $exists: false }
      } else if (!filter.status) {
        filter.status = { $ne: 'removed' }
      }
    }

    const sort = req.query.sort === 'trending' ? { answer_count: -1, upvotes: -1 } : { created_at: -1 }
    const [questions, total] = await Promise.all([
      Question.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Question.countDocuments(filter),
    ])

    const nameById = await getDisplayNameByUserId(questions.map((q) => q.author_id))

    // Attach hasVoted by checking the Vote collection for +1 votes by the current user
    const questionIds = questions.map((q) => q.question_id)
    const myUpvotes = await Vote.find({
      user_id: req.user.userId,
      target_type: 'question',
      target_id: { $in: questionIds },
      value: 1,
    }).select('target_id')
    const upvotedSet = new Set(myUpvotes.map((v) => v.target_id))

    // Admins always see real names; anonymity is for students only
    const realNameById = await getRealNameByUserId(questions.map((q) => q.author_id))

    res.json({
      success: true,
      questions: questions.map((q) => ({
        ...q,
        author_name: isAdmin(req) ? (realNameById[q.author_id] || nameById[q.author_id] || 'User') :
                     (q.is_anonymous ? 'Anonymous' : nameById[q.author_id] || 'User'),
        hasVoted: upvotedSet.has(q.question_id),
      })),
      pagination: paginationResult(page, limit, total),
    })
  } catch (error) {
    next(error)
  }
}

/** Distinct tags across published community questions, ranked by usage. */
export async function listQuestionTags(req, res, next) {
  try {
    const tags = await Question.aggregate([
      {
        $match: {
          kind: 'community',
          status: { $ne: 'removed' },
          moderation_status: 'approved',
        },
      },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 12 },
    ])

    res.json({
      success: true,
      tags: tags.map((t) => ({ tag: t._id, count: t.count })),
    })
  } catch (error) {
    next(error)
  }
}

export async function getQuestionById(req, res, next) {
  try {
    const question = await Question.findOne({ question_id: req.params.questionId })

    if (
      !question ||
      (!isAdmin(req) &&
        (question.status === 'removed' || question.moderation_status !== 'approved'))
    ) {
      throw createHttpError(404, 'Question not found')
    }

    await Question.updateOne(
      { question_id: question.question_id },
      { $inc: { view_count: 1 } },
    )

    const includeAnswers = req.query.includeAnswers !== 'false'
    const includeComments = req.query.includeComments !== 'false'

    // Fetch ALL answers/comments for the question. Hidden ones (flagged → pending,
    // or soft-deleted) are kept as redacted tombstones so the thread shows
    // "this reply is under review / was deleted" instead of silently vanishing.
    const [answers, comments] = await Promise.all([
      includeAnswers ? Answer.find({ question_id: question.question_id }).sort({ is_accepted: -1, score: -1, created_at: 1 }).lean() : [],
      includeComments ? Comment.find({ question_id: question.question_id }).sort({ created_at: 1 }).lean() : [],
    ])

    const authorIds = [
      question.author_id,
      ...answers.map((a) => a.author_id),
      ...comments.map((c) => c.author_id),
    ]
    const nameById = await getDisplayNameByUserId(authorIds)
    const realNameById = await getRealNameByUserId(authorIds)

    const admin = isAdmin(req)
    function moderationState(doc) {
      if (doc.is_deleted) return 'deleted'
      if (doc.moderation_status && doc.moderation_status !== 'approved') return 'under_review'
      return 'visible'
    }
    // Decorate with author name + moderation state; redact hidden bodies for non-admins.
    // Admins always see real names for all contributors; anonymity is for students only.
    function decorate(doc) {
      const authorName = admin
        ? (realNameById[doc.author_id] || nameById[doc.author_id] || 'User')
        : (doc.author_role === 'ADMIN' ? 'ADMIN' : (nameById[doc.author_id] || 'User'))
      const base = { ...doc, author_name: authorName }
      const state = moderationState(doc)
      if (admin || state === 'visible') {
        return { ...base, moderation_state: 'visible' }
      }
      const { body_plain: _, ...docWithoutPlain } = base
      return { ...docWithoutPlain, moderation_state: state, body: '' }
    }

    // Current user's vote on each answer (for highlight / deselect)
    const myVotes = await Vote.find({
      user_id: req.user.userId,
      target_type: 'answer',
      target_id: { $in: answers.map((a) => a.answer_id) },
    }).lean()
    const voteByAnswer = Object.fromEntries(myVotes.map((v) => [v.target_id, v.value]))

    const questionObj = question.toObject()

    res.json({
      success: true,
      question: {
        ...questionObj,
        author_name: isAdmin(req)
        ? (realNameById[questionObj.author_id] || nameById[questionObj.author_id] || 'User')
        : (questionObj.is_anonymous ? 'Anonymous' : nameById[questionObj.author_id] || 'User'),
      },
      answers: answers.map((a) => ({ ...decorate(a), my_vote: voteByAnswer[a.answer_id] || 0 })),
      comments: comments.map(decorate),
    })
  } catch (error) {
    next(error)
  }
}

export async function updateQuestion(req, res, next) {
  try {
    const question = await Question.findOne({ question_id: req.params.questionId })

    if (!question) {
      throw createHttpError(404, 'Question not found')
    }
    if (!canManage(req, question)) {
      throw createHttpError(403, 'Forbidden')
    }
    if (!isAdmin(req) && ['closed', 'removed'].includes(question.status)) {
      throw createHttpError(409, 'Question locked or resolved')
    }

    for (const field of ['title', 'body', 'tags']) {
      if (req.body[field] !== undefined) {
        question[field] = req.body[field]
      }
    }
    await question.save()

    res.json({ success: true, question })
  } catch (error) {
    next(error)
  }
}

export async function deleteQuestion(req, res, next) {
  try {
    const question = await Question.findOne({ question_id: req.params.questionId })

    if (!question) {
      throw createHttpError(404, 'Question not found')
    }
    if (!canManage(req, question)) {
      throw createHttpError(403, 'Forbidden')
    }
    if (question.status === 'removed') {
      throw createHttpError(409, 'Question cannot be deleted')
    }

    question.status = 'removed'
    question.moderation_status = 'rejected'
    question.removal_reason = req.body.reason || ''
    await question.save()

    res.json({ success: true, message: 'Question deleted' })
  } catch (error) {
    next(error)
  }
}

export async function acceptAnswer(req, res, next) {
  try {
    const [question, answer] = await Promise.all([
      Question.findOne({ question_id: req.params.questionId }),
      Answer.findOne({
        answer_id: req.params.answerId,
        question_id: req.params.questionId,
        is_deleted: { $ne: true },
      }),
    ])

    if (!question || !answer) {
      throw createHttpError(404, 'Question or answer not found')
    }
    if (!canManage(req, question)) {
      throw createHttpError(403, 'Forbidden')
    }
    const acceptedAnswer = await Answer.exists({
      question_id: question.question_id,
      is_accepted: true,
      is_deleted: { $ne: true },
    })

    if (acceptedAnswer) {
      throw createHttpError(409, 'Answer already accepted')
    }

    answer.is_accepted = true
    await answer.save()
    // Accepting a resolution closes (resolves) the question
    question.status = 'closed'
    await question.save()

    await awardSpark({
      userId: answer.author_id,
      action: 'ANSWER_ACCEPTED',
      referenceId: answer.answer_id,
      referenceType: 'answer',
    })

    if (question.spark_bounty > 0) {
      await awardSpark({
        userId: answer.author_id,
        action: 'BOUNTY_AWARDED',
        referenceId: question.question_id,
        referenceType: 'question',
        points: question.spark_bounty,
      })
    }

    await Notification.create({
      recipient_id: answer.author_id,
      actor_id: req.user.userId,
      type: 'accepted',
      title: 'Answer accepted',
      body: 'Your answer was accepted.',
      reference_id: question.question_id,
      reference_type: 'question',
      link: `/query/${question.question_id}`,
    })

    res.json({ success: true, message: 'Answer accepted' })
  } catch (error) {
    next(error)
  }
}

/** Owner/admin marks their question resolved (closed) or reopens it. */
export async function resolveQuestion(req, res, next) {
  try {
    const question = await Question.findOne({ question_id: req.params.questionId })

    if (!question || question.status === 'removed') {
      throw createHttpError(404, 'Question not found')
    }
    if (!canManage(req, question)) {
      throw createHttpError(403, 'Only the author can resolve this question')
    }

    const resolved = req.body.resolved !== false // default: true
    question.status = resolved
      ? 'closed'
      : (question.answer_count > 0 ? 'answered' : 'unanswered')
    await question.save()

    res.json({ success: true, status: question.status, resolved })
  } catch (error) {
    next(error)
  }
}

export async function voteQuestion(req, res, next) {
  try {
    const { questionId } = req.params
    const userId = req.user.userId

    const question = await Question.findOne({ question_id: questionId })

    if (!question || question.status === 'removed') {
      throw createHttpError(404, 'Question not found')
    }

    if (question.author_id === userId) {
      throw createHttpError(403, 'Cannot vote on your own question')
    }

    const existingVote = await Vote.findOne({
      user_id: userId,
      target_type: 'question',
      target_id: question.question_id,
    })

    if (existingVote) {
      await existingVote.deleteOne()
      await Question.updateOne(
        { question_id: questionId },
        { $inc: { upvotes: -1 } },
      )
    } else {
      await Vote.create({
        user_id: userId,
        target_type: 'question',
        target_id: question.question_id,
        value: 1,
      })
      await Question.updateOne(
        { question_id: questionId },
        { $inc: { upvotes: 1 } },
      )
    }

    const updated = await Question.findOne({ question_id: questionId }).select('upvotes').lean()

    res.json({
      success: true,
      upvotes: updated?.upvotes || 0,
      hasVoted: !existingVote,
    })
  } catch (error) {
    next(error)
  }
}
