import Answer from '../models/answer.model.js'
import Comment from '../models/comment.model.js'
import Notification from '../models/notification.model.js'
import Question from '../models/question.model.js'
import Role from '../models/role.model.js'
import UserProfile from '../models/user-profile.model.js'
import UserRoleMapper from '../models/user-role-mapper.model.js'
import User from '../models/user.model.js'
import { getUserRoles, normalizeRoleName } from '../services/role.service.js'
import {
  createHttpError,
  escapeRegex,
  getPagination,
  paginationResult,
} from '../utils/http.js'

function publicUser(user, roles, includeEmail = false, profile = null) {
  const value = {
    id: user.user_id,
    name: profile?.display_name || user.name,
    roles,
    avatarUrl: profile?.avatar_url || '',
    sparkPoints: user.spark_points || 0,
    createdAt: user.created_at,
  }

  if (includeEmail) {
    value.email = user.email
    value.status = user.status || 'active'
  }

  return value
}

function publicProfile(profile, canViewPrivate) {
  if (!profile || canViewPrivate) {
    return profile || {}
  }

  return {
    displayName: profile.display_name,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    expertise: profile.expertise || [],
    reputation: profile.reputation || 0,
  }
}

export async function listUsers(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query)
    const filter = {}
    const role = req.query.role ? normalizeRoleName(req.query.role) : null

    if (req.query.role && !role) {
      throw createHttpError(400, 'Invalid role')
    }

    if (req.query.status) {
      filter.status = req.query.status
    }

    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const search = new RegExp(escapeRegex(req.query.search.trim()), 'i')
      filter.$or = [{ name: search }, { email: search }]
    }

    if (role) {
      const roleDocument = await Role.findOne({ name: role.toLowerCase() }).lean()
      const mappings = roleDocument
        ? await UserRoleMapper.find({ role_id: roleDocument.role_id }).select('user_id').lean()
        : []
      const userIds = mappings.map((mapping) => mapping.user_id)

      filter.user_id = { $in: userIds }
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ])
    const profiles = await UserProfile.find({
      user_id: { $in: users.map((user) => user.user_id) },
    }).lean()
    const profileByUserId = Object.fromEntries(
      profiles.map((profile) => [profile.user_id, profile]),
    )

    const result = await Promise.all(
      users.map(async (user) =>
        publicUser(user, await getUserRoles(user), true, profileByUserId[user.user_id]),
      ),
    )

    res.json({
      success: true,
      users: result,
      pagination: paginationResult(page, limit, total),
    })
  } catch (error) {
    next(error)
  }
}

export async function getUserById(req, res, next) {
  try {
    const user = await User.findOne({ user_id: req.params.userId })

    if (!user) {
      throw createHttpError(404, 'User not found')
    }

    const [roles, profile, questionsCount, answersCount, acceptedAnswersCount] =
      await Promise.all([
        getUserRoles(user),
        UserProfile.findOne({ user_id: user.user_id }).lean(),
        Question.countDocuments({ author_id: user.user_id }),
        Answer.countDocuments({ author_id: user.user_id }),
        Answer.countDocuments({
          author_id: user.user_id,
          is_accepted: true,
          is_deleted: { $ne: true },
        }),
      ])

    const canViewEmail =
      req.user.userId === user.user_id || req.user.roles.includes('ADMIN')

    res.json({
      success: true,
      user: {
        ...publicUser(user, roles, canViewEmail, profile),
        profile: publicProfile(profile, canViewEmail),
        stats: { questionsCount, answersCount, acceptedAnswersCount },
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const allowedStatuses = ['active', 'disabled', 'suspended']
    const status = typeof req.body.status === 'string' ? req.body.status.toLowerCase() : ''

    if (!allowedStatuses.includes(status)) {
      throw createHttpError(400, 'Status must be active, disabled, or suspended')
    }

    const existingUser = await User.findOne({ user_id: req.params.userId })

    if (!existingUser) {
      throw createHttpError(404, 'User not found')
    }

    if (
      status !== 'active' &&
      (!existingUser.status || existingUser.status === 'active') &&
      (await getUserRoles(existingUser)).includes('ADMIN')
    ) {
      const adminRole = await Role.findOne({ name: 'admin' }).lean()
      const adminMappings = adminRole
        ? await UserRoleMapper.find({ role_id: adminRole.role_id }).select('user_id').lean()
        : []
      const activeAdminCount = await User.countDocuments({
        user_id: { $in: adminMappings.map((mapping) => mapping.user_id) },
        $or: [{ status: 'active' }, { status: { $exists: false } }],
      })

      if (activeAdminCount <= 1) {
        throw createHttpError(409, 'Cannot disable final active admin')
      }
    }

    const user = await User.findOneAndUpdate(
      { user_id: req.params.userId },
      {
        $set: {
          status,
          status_reason: req.body.reason || '',
          status_updated_by: req.user.userId,
          status_updated_at: new Date(),
        },
      },
      { new: true, runValidators: true },
    )

    if (user.user_id !== req.user.userId) {
      await Notification.create({
        recipient_id: user.user_id,
        actor_id: req.user.userId,
        type: 'account_status',
        title: 'Account status updated',
        body: `Your account status is now ${status}.`,
        reference_id: user.user_id,
        reference_type: 'user',
      })
    }

    res.json({ success: true, message: 'User status updated' })
  } catch (error) {
    next(error)
  }
}

export async function getUserContributions(req, res, next) {
  try {
    const userId = req.params.userId
    const limit = Math.min(parseInt(req.query.limit) || 10, 100)

    // Only reveal anonymous questions to the author themselves or an admin
    const isSelfOrAdmin = req.user.userId === userId || req.user.roles.includes('ADMIN')
    const questionFilter = {
      author_id: userId,
      visibility: { $ne: 'deleted' },
    }
    if (isSelfOrAdmin) {
      questionFilter.$or = [
        { status: { $ne: 'removed' } },
        { status: 'removed', moderation_status: 'rejected', moderated_by: { $exists: true, $ne: null } }
      ]
    } else {
      questionFilter.status = { $ne: 'removed' }
      questionFilter.is_anonymous = { $ne: true }
    }

    const answerFilter = {
      author_id: userId,
      visibility: { $ne: 'deleted' },
    }
    if (isSelfOrAdmin) {
      answerFilter.$or = [
        { is_deleted: { $ne: true } },
        { is_deleted: true, moderation_status: 'rejected', moderated_by: { $exists: true, $ne: null } }
      ]
    } else {
      answerFilter.is_deleted = { $ne: true }
    }

    const commentFilter = {
      author_id: userId,
      visibility: { $ne: 'deleted' },
    }
    if (isSelfOrAdmin) {
      commentFilter.$or = [
        { is_deleted: { $ne: true } },
        { is_deleted: true, moderation_status: 'rejected', moderated_by: { $exists: true, $ne: null } }
      ]
    } else {
      commentFilter.is_deleted = { $ne: true }
    }

    const [
      questions,
      answers,
      comments,
      questionsCount,
      answersCount,
      commentsCount,
      acceptedAnswersCount,
    ] = await Promise.all([
      Question.find(questionFilter)
        .select('question_id title body status upvotes answer_count created_at moderation_status moderated_by')
        .sort({ created_at: -1 })
        .limit(limit)
        .lean(),
      Answer.find(answerFilter)
        .select('answer_id question_id body upvotes score comment_count is_accepted created_at moderation_status moderated_by')
        .sort({ created_at: -1 })
        .limit(limit)
        .lean(),
      Comment.find(commentFilter)
        .select('comment_id question_id answer_id body score reply_count created_at moderation_status moderated_by')
        .sort({ created_at: -1 })
        .limit(limit)
        .lean(),
      Question.countDocuments(questionFilter),
      Answer.countDocuments(answerFilter),
      Comment.countDocuments(commentFilter),
      Answer.countDocuments({ ...answerFilter, is_accepted: true }),
    ])

    const contributions = [
      ...questions.map(q => ({
        type: 'question',
        id: q.question_id,
        title: q.title,
        body: q.body,
        status: q.status,
        score: q.upvotes || 0,
        answerCount: q.answer_count || 0,
        time: q.created_at,
        isUpheld: q.moderation_status === 'rejected' && typeof q.moderated_by === 'string' && q.moderated_by.length > 0,
      })),
      ...answers.map(a => ({
        type: 'answer',
        id: a.answer_id,
        questionId: a.question_id,
        body: a.body,
        score: a.upvotes ?? a.score ?? 0,
        commentCount: a.comment_count || 0,
        isAccepted: a.is_accepted,
        time: a.created_at,
        isUpheld: a.moderation_status === 'rejected' && typeof a.moderated_by === 'string' && a.moderated_by.length > 0,
      })),
      ...comments.map(c => ({
        type: 'comment',
        id: c.comment_id,
        questionId: c.question_id,
        answerId: c.answer_id,
        body: c.body,
        score: c.score || 0,
        replyCount: c.reply_count || 0,
        time: c.created_at,
        isUpheld: c.moderation_status === 'rejected' && typeof c.moderated_by === 'string' && c.moderated_by.length > 0,
      })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, limit)

    res.json({
      success: true,
      contributions,
      stats: {
        question: questionsCount,
        answer: answersCount,
        comment: commentsCount,
        accepted: acceptedAnswersCount,
        total: questionsCount + answersCount + commentsCount,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function getMyContributions(req, res, next) {
  req.params.userId = req.user.userId
  return getUserContributions(req, res, next)
}
