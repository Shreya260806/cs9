import Answer from '../models/answer.model.js'
import Comment from '../models/comment.model.js'
import Notification from '../models/notification.model.js'
import Question from '../models/question.model.js'
import SparkTransaction from '../models/spark-transaction.model.js'
import UserProfile from '../models/user-profile.model.js'
import User from '../models/user.model.js'
import { getPlatformSettings } from '../services/platform-settings.service.js'
import { getUserIdsByRole } from '../services/role.service.js'
import {
  createHttpError,
  getCreatedAtFilter,
  getPagination,
  paginationResult,
} from '../utils/http.js'

async function getDisplayNameByUserId(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))]

  if (!ids.length) {
    return {}
  }

  const [users, profiles] = await Promise.all([
    User.find({ user_id: { $in: ids } }).select('user_id name').lean(),
    UserProfile.find({ user_id: { $in: ids } }).select('user_id display_name').lean(),
  ])
  const displayNameById = Object.fromEntries(users.map((user) => [user.user_id, user.name]))

  for (const profile of profiles) {
    if (profile.display_name) {
      displayNameById[profile.user_id] = profile.display_name
    }
  }

  return displayNameById
}

export async function getSparkBalance(req, res, next) {
  try {
    const profile = await UserProfile.findOne({ user_id: req.user.userId })

    res.json({
      success: true,
      sparkBalance: req.authUser.spark_points || 0,
      reputation: profile?.reputation || 0,
    })
  } catch (error) {
    next(error)
  }
}

export async function listSparkTransactions(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query)
    const filter = { user_id: req.user.userId }
    const createdAt = getCreatedAtFilter(req.query.from, req.query.to)

    if (req.query.type) {
      filter.action = req.query.type
    }
    if (createdAt) {
      filter.created_at = createdAt
    }

    const [transactions, total] = await Promise.all([
      SparkTransaction.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      SparkTransaction.countDocuments(filter),
    ])

    res.json({
      success: true,
      transactions,
      pagination: paginationResult(page, limit, total),
    })
  } catch (error) {
    next(error)
  }
}

// Start of the requested time window, or null for all-time.
function getWindowStart(window) {
  const now = new Date()
  if (window === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start
  }
  if (window === 'monthly') {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return null
}

// All-time answer stats per author: count of (non-deleted) answers and the
// total upvotes those answers received. Powers the leaderboard's
// "Questions Answered" / "Upvotes Received" columns.
async function getAnswerStatsByUser(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) {
    return {}
  }
  const rows = await Answer.aggregate([
    { $match: { author_id: { $in: ids }, is_deleted: { $ne: true } } },
    {
      $group: {
        _id: '$author_id',
        answersCount: { $sum: 1 },
        upvotesReceived: { $sum: '$upvotes' },
      },
    },
  ])
  return Object.fromEntries(
    rows.map((row) => [
      row._id,
      { answersCount: row.answersCount, upvotesReceived: row.upvotesReceived || 0 },
    ]),
  )
}

function keyed(rows, mapValue) {
  return Object.fromEntries(rows.map((row) => [row._id, mapValue(row)]))
}

async function getWeightedReputationLeaderboard({ userFilter, limit }) {
  const settings = await getPlatformSettings()
  const weights = settings.leaderboard

  const users = await User.find(userFilter).select('user_id name spark_points').lean()
  const userIds = users.map((user) => user.user_id)

  if (!userIds.length) {
    return []
  }

  const [
    profiles,
    questionRows,
    answerRows,
    commentRows,
    warningRows,
  ] = await Promise.all([
    UserProfile.find({ user_id: { $in: userIds } }).select('user_id display_name reputation').lean(),
    Question.aggregate([
      {
        $match: {
          author_id: { $in: userIds },
          kind: 'community',
          status: { $ne: 'removed' },
        },
      },
      {
        $group: {
          _id: '$author_id',
          questionsAsked: { $sum: 1 },
          questionUpvotes: { $sum: '$upvotes' },
        },
      },
    ]),
    Answer.aggregate([
      {
        $match: {
          author_id: { $in: userIds },
          is_deleted: { $ne: true },
          visibility: { $ne: 'deleted' },
        },
      },
      {
        $group: {
          _id: '$author_id',
          answersGiven: { $sum: 1 },
          acceptedResolutions: { $sum: { $cond: ['$is_accepted', 1, 0] } },
          answerUpvotes: { $sum: '$upvotes' },
          resolverActivity: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$author_role', 'RESOLVER'] },
                    { $eq: ['$is_expert', true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Comment.aggregate([
      {
        $match: {
          author_id: { $in: userIds },
          is_deleted: { $ne: true },
          visibility: { $ne: 'deleted' },
        },
      },
      {
        $group: {
          _id: '$author_id',
          commentsGiven: { $sum: 1 },
          commentUpvotes: { $sum: '$upvotes' },
        },
      },
    ]),
    Notification.aggregate([
      {
        $match: {
          recipient_id: { $in: userIds },
          type: { $in: ['warning', 'content_hidden'] },
        },
      },
      { $group: { _id: '$recipient_id', negativeActions: { $sum: 1 } } },
    ]),
  ])

  const profileById = Object.fromEntries(profiles.map((profile) => [profile.user_id, profile]))
  const questionsById = keyed(questionRows, (row) => row)
  const answersById = keyed(answerRows, (row) => row)
  const commentsById = keyed(commentRows, (row) => row)
  const warningsById = keyed(warningRows, (row) => row.negativeActions)

  return users
    .map((user) => {
      const profile = profileById[user.user_id]
      const questions = questionsById[user.user_id] || {}
      const answers = answersById[user.user_id] || {}
      const comments = commentsById[user.user_id] || {}
      const upvotesReceived =
        (questions.questionUpvotes || 0) +
        (answers.answerUpvotes || 0) +
        (comments.commentUpvotes || 0)
      const score =
        (questions.questionsAsked || 0) * weights.questionsAskedWeight +
        (answers.answersGiven || 0) * weights.answersGivenWeight +
        (comments.commentsGiven || 0) * weights.commentsGivenWeight +
        (answers.acceptedResolutions || 0) * weights.acceptedResolutionsWeight +
        upvotesReceived * weights.upvotesReceivedWeight +
        (answers.resolverActivity || 0) * weights.resolverActivityWeight +
        (user.spark_points || 0) * weights.sparkPointsWeight +
        (profile?.reputation || 0) * weights.reputationWeight -
        (warningsById[user.user_id] || 0) * weights.warningPenaltyWeight

      return {
        userId: user.user_id,
        displayName: profile?.display_name || user.name,
        score: Math.round(score * 100) / 100,
        questionsAsked: questions.questionsAsked || 0,
        answersCount: answers.answersGiven || 0,
        commentsCount: comments.commentsGiven || 0,
        acceptedResolutions: answers.acceptedResolutions || 0,
        upvotesReceived,
      }
    })
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
    .slice(0, limit)
}

export async function getLeaderboard(req, res, next) {
  try {
    const { limit } = getPagination({ page: 1, limit: req.query.limit || 20 })
    const type = req.query.type || 'reputation'
    const role = req.query.role ? String(req.query.role).toUpperCase() : undefined
    const sparkWindow = req.query.window ? String(req.query.window).toLowerCase() : 'all'

    if (!['reputation', 'spark', 'acceptedAnswers'].includes(type)) {
      throw createHttpError(400, 'Invalid leaderboard type')
    }
    if (!['all', 'today', 'monthly'].includes(sparkWindow)) {
      throw createHttpError(400, 'Invalid window')
    }
    if (role && !['USER', 'RESOLVER', 'ADMIN'].includes(role)) {
      throw createHttpError(400, 'Invalid role')
    }

    const roleUserIds = role ? await getUserIdsByRole(role) : null
    // Admins never appear on the public leaderboard. (An explicit role=ADMIN
    // query is an internal lookup, so we don't exclude them in that case.)
    const excludedUserIds = role === 'ADMIN' ? [] : await getUserIdsByRole('ADMIN')

    // Build a user-id match that combines the optional role inclusion ($in)
    // with the admin exclusion ($nin). Returns {} when neither applies.
    const userIdMatch = (field) => {
      const condition = {}
      if (roleUserIds) condition.$in = roleUserIds
      if (excludedUserIds.length) condition.$nin = excludedUserIds
      return Object.keys(condition).length ? { [field]: condition } : {}
    }

    const userFilter = userIdMatch('user_id')
    let leaderboard

    if (type === 'acceptedAnswers') {
      const acceptedAnswersMatch = {
        is_accepted: true,
        is_deleted: { $ne: true },
        ...userIdMatch('author_id'),
      }

      const rows = await Answer.aggregate([
        { $match: acceptedAnswersMatch },
        { $group: { _id: '$author_id', score: { $sum: 1 } } },
        { $sort: { score: -1 } },
        { $limit: limit },
      ])
      const candidateUserIds = rows.map((row) => row._id)
      const users = await User.find({
        user_id: { $in: candidateUserIds },
      }).lean()
      const byId = Object.fromEntries(users.map((user) => [user.user_id, user]))
      const displayNameById = await getDisplayNameByUserId(users.map((user) => user.user_id))

      leaderboard = rows
        .filter((row) => byId[row._id])
        .slice(0, limit)
        .map((row) => ({
          userId: row._id,
          displayName: displayNameById[row._id] || byId[row._id].name,
          score: row.score,
        }))
    } else if (type === 'reputation') {
      leaderboard = await getWeightedReputationLeaderboard({ userFilter, limit })
    } else {
      // Spark points. All-time reads the cached User.spark_points balance;
      // today/monthly sum the spark ledger within the window.
      let sparkRows // [{ userId, score }]
      if (sparkWindow === 'all') {
        const users = await User.find(userFilter).sort({ spark_points: -1 }).limit(limit).lean()
        sparkRows = users.map((user) => ({ userId: user.user_id, score: user.spark_points || 0 }))
      } else {
        const agg = await SparkTransaction.aggregate([
          { $match: { created_at: { $gte: getWindowStart(sparkWindow) }, ...userIdMatch('user_id') } },
          { $group: { _id: '$user_id', score: { $sum: '$points' } } },
          { $sort: { score: -1 } },
          { $limit: limit },
        ])
        sparkRows = agg.map((row) => ({ userId: row._id, score: row.score || 0 }))
      }

      const candidateUserIds = sparkRows.map((row) => row.userId)
      const [displayNameById, statsById] = await Promise.all([
        getDisplayNameByUserId(candidateUserIds),
        getAnswerStatsByUser(candidateUserIds),
      ])
      leaderboard = sparkRows.map((row) => ({
        userId: row.userId,
        displayName: displayNameById[row.userId] || 'User',
        score: row.score,
        answersCount: statsById[row.userId]?.answersCount || 0,
        upvotesReceived: statsById[row.userId]?.upvotesReceived || 0,
      }))
    }

    res.json({ success: true, leaderboard })
  } catch (error) {
    next(error)
  }
}
