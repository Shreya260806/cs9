import Answer from '../models/answer.model.js'
import Comment from '../models/comment.model.js'
import Notification from '../models/notification.model.js'
import Question from '../models/question.model.js'
import {
  createHttpError,
  getPagination,
  paginationResult,
} from '../utils/http.js'

function isAdmin(req) {
  return req.user.roles.includes('ADMIN')
}

function commentTargetFilter(targetType, targetId) {
  if (targetType === 'answer') {
    return { answer_id: targetId }
  }
  if (targetType === 'question') {
    return { question_id: targetId }
  }
  throw createHttpError(400, 'Target type must be question or answer')
}

export async function createComment(req, res, next) {
  try {
    const { targetType, targetId, parentId } = req.body
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : ''

    if (targetType !== 'answer') {
      throw createHttpError(400, 'Comments must be attached to an answer')
    }
    if (!targetId || !body) {
      throw createHttpError(400, 'Target and comment body are required')
    }

    const answer = await Answer.findOne({ answer_id: targetId, is_deleted: { $ne: true } })
    if (!answer) {
      throw createHttpError(404, 'Target not found')
    }

    // No new replies once the question is resolved (closed), removed, or locked
    const question = await Question.findOne({ question_id: answer.question_id }).select('status is_locked')
    if (question && ['closed', 'removed'].includes(question.status)) {
      throw createHttpError(409, 'Question closed')
    }
    if (question?.is_locked) {
      throw createHttpError(423, 'Question is locked')
    }

    let parent = null
    if (parentId) {
      parent = await Comment.findOne({ comment_id: parentId, answer_id: answer.answer_id })
      if (!parent) {
        throw createHttpError(404, 'Parent comment not found')
      }
      if (parent.depth !== 0) {
        throw createHttpError(422, 'Replies may only be nested one level deep')
      }
    }

    const comment = await Comment.create({
      question_id: answer.question_id,
      answer_id: answer.answer_id,
      parent_id: parent?.comment_id || null,
      root_comment_id: parent?.comment_id || null,
      depth: parent ? 1 : 0,
      author_id: req.user.userId,
      body,
    })

    await Answer.updateOne(
      { answer_id: answer.answer_id },
      {
        $inc: {
          comment_count: 1,
          ...(parent ? {} : { top_level_comment_count: 1 }),
        },
      },
    )

    if (parent) {
      await Comment.updateOne({ comment_id: parent.comment_id }, { $inc: { reply_count: 1 } })
    }

    const recipientId = parent ? parent.author_id : answer.author_id
    if (recipientId !== req.user.userId) {
      await Notification.create({
        recipient_id: recipientId,
        actor_id: req.user.userId,
        type: parent ? 'reply' : 'comment',
        title: parent ? 'New reply' : 'New comment',
        body: parent ? 'Someone replied to your comment.' : 'Someone commented on your answer.',
        reference_id: comment.comment_id,
        reference_type: 'comment',
        link: `/query/${answer.question_id}`,
        ...(parent && {
          thread_anchor: {
            answer_id: answer.answer_id,
            root_comment_id: parent.comment_id,
          },
        }),
      })
    }

    res.status(201).json({
      success: true,
      commentId: comment.comment_id,
      message: 'Comment created',
    })
  } catch (error) {
    next(error)
  }
}

export async function listComments(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query)

    if (!req.query.targetId) {
      throw createHttpError(400, 'Target id is required')
    }

    const filter = commentTargetFilter(req.query.targetType, req.query.targetId)
    const targetExists =
      req.query.targetType === 'answer'
        ? await Answer.exists({ answer_id: req.query.targetId })
        : await Question.exists({ question_id: req.query.targetId })

    if (!targetExists) {
      throw createHttpError(404, 'Target not found')
    }

    if (!isAdmin(req)) {
      filter.moderation_status = 'approved'
      filter.is_deleted = { $ne: true }
    }

    const [comments, total] = await Promise.all([
      Comment.find(filter).sort({ created_at: 1 }).skip(skip).limit(limit).lean(),
      Comment.countDocuments(filter),
    ])

    res.json({
      success: true,
      comments,
      pagination: paginationResult(page, limit, total),
    })
  } catch (error) {
    next(error)
  }
}

export async function updateComment(req, res, next) {
  try {
    const comment = await Comment.findOne({ comment_id: req.params.commentId })
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : ''

    if (!comment) {
      throw createHttpError(404, 'Comment not found')
    }
    if (!isAdmin(req) && comment.author_id !== req.user.userId) {
      throw createHttpError(403, 'Forbidden')
    }
    if (!isAdmin(req)) {
      const createdTime = new Date(comment.created_at).getTime()
      const diffMs = Date.now() - createdTime
      if (diffMs > 15 * 60 * 1000) {
        throw createHttpError(403, 'Comments can only be edited within 15 minutes of posting')
      }
    }
    if (!body) {
      throw createHttpError(400, 'Comment body is required')
    }

    comment.body = body
    await comment.save()

    res.json({ success: true, comment })
  } catch (error) {
    next(error)
  }
}

export async function deleteComment(req, res, next) {
  try {
    const comment = await Comment.findOne({ comment_id: req.params.commentId })

    if (!comment) {
      throw createHttpError(404, 'Comment not found')
    }
    if (!isAdmin(req) && comment.author_id !== req.user.userId) {
      throw createHttpError(403, 'Forbidden')
    }

    // Soft-delete: preserve body for audit purposes, consistent with answer deletion
    comment.is_deleted = true
    await comment.save()

    res.json({ success: true, message: 'Comment deleted' })
  } catch (error) {
    next(error)
  }
}
