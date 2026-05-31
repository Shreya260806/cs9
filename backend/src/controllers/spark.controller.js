import Answer from '../models/answer.model.js'
import SparkTransaction from '../models/spark-transaction.model.js'
import UserProfile from '../models/user-profile.model.js'
import User from '../models/user.model.js'
import { getPlatformSettings } from '../services/platform-settings.service.js'
import {
  buildLeaderboardRows,
  getContributorStats,
} from '../services/leaderboard.service.js'
import { getUserIdsByRole } from '../services/role.service.js'
import {
  createHttpError,
  getCreatedAtFilter,
  getPagination,
  paginationResult,
} from '../utils/http.js'

async function getDisplayNameByUserId(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return {}
  const [users, profiles] = await Promise.all([
    User.find({ user_id: { $in: ids } }).select('user_id name').lean(),
    UserProfile.find({ user_id: { $in: ids } }).select('user_id display_name').lean(),
  ])
  const displayNameById = Object.fromEntries(users.map((u) => [u.user_id, u.name]))
  for (const profile of profiles) {
    if (profile.display_name) displayNameById[profile.user_id] = profile.display_name
  }
  return displayNameById
}

/**
 * Like getDisplayNameByUserId but ignores UserProfile display_name overrides —
 * always returns the real User.name. Used for admin-facing leaderboards so that
 * admins always see the actual identity even when a user has set an
 * "Anonymous" display name in their profile.
 */
async function getRealNameByUserId(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return {}
  const users = await User.find({ user_id: { $in: ids } }).select('user_id name').lean()
  return Object.fromEntries(users.map((u) => [u.user_id, u.name || 'Unknown']))
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

    if (req.query.type) filter.action = req.query.type
    if (createdAt) filter.created_at = createdAt

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
  if (!ids.length) return {}
  const rows = await Answer.aggregate([
    { $match: { author_id: { $in: ids }, is_deleted: { $ne: true } } },
    { $group: { _id: '$author_id', answersCount: { $sum: 1 }, upvotesReceived: { $sum: '$upvotes' } } },
  ])
  return Object.fromEntries(
    rows.map((r) => [r._id, { answersCount: r.answersCount, upvotesReceived: r.upvotesReceived || 0 }]),
  )
}

async function getWeightedReputationLeaderboard({ userFilter, limit, isAdmin }) {
  const settings = await getPlatformSettings()
  const weights = settings.leaderboard

  const users = await User.find(userFilter).select('user_id name spark_points').lean()
  const userIds = users.map((u) => u.user_id)
  if (!userIds.length) return []

  const statsById = await getContributorStats(userIds, isAdmin ? getRealNameByUserId : null)

  // Fill sparkPoints from the User docs (not in contributor stats)
  for (const user of users) {
    if (statsById[user.user_id]) {
      statsById[user.user_id].sparkPoints = user.spark_points || 0
    }
  }

  const usersWithStats = users.map((u) => ({ user: u, stats: statsById[u.user_id] || {} }))
  return buildLeaderboardRows(usersWithStats, weights).slice(0, limit)
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
      const users = await User.find({ user_id: { $in: candidateUserIds } }).lean()
      const byId = Object.fromEntries(users.map((u) => [u.user_id, u]))
      // Admins always see real names; regular requests respect display_name overrides
      const nameResolver = req.isAdmin ? getRealNameByUserId : getDisplayNameByUserId
      const displayNameById = await nameResolver(users.map((u) => u.user_id))

      leaderboard = rows
        .filter((row) => byId[row._id])
        .slice(0, limit)
        .map((row) => ({
          userId: row._id,
          displayName: displayNameById[row._id] || byId[row._id].name,
          score: row.score,
        }))
    } else if (type === 'reputation') {
      leaderboard = await getWeightedReputationLeaderboard({ userFilter, limit, isAdmin: req.isAdmin })
    } else {
      // Spark points. All-time reads the cached User.spark_points balance;
      // today/monthly sum the spark ledger within the window.
      let sparkRows
      if (sparkWindow === 'all') {
        const users = await User.find(userFilter).sort({ spark_points: -1 }).limit(limit).lean()
        sparkRows = users.map((u) => ({ userId: u.user_id, score: u.spark_points || 0 }))
      } else {
        const agg = await SparkTransaction.aggregate([
          { $match: { created_at: { $gte: getWindowStart(sparkWindow) }, ...userIdMatch('user_id') } },
          { $group: { _id: '$user_id', score: { $sum: '$points' } } },
          { $sort: { score: -1 } },
          { $limit: limit },
        ])
        sparkRows = agg.map((r) => ({ userId: r._id, score: r.score || 0 }))
      }

      const candidateUserIds = sparkRows.map((r) => r.userId)
      // Admins always see real names; regular requests respect display_name overrides
      const nameResolver = req.isAdmin ? getRealNameByUserId : getDisplayNameByUserId
      const [displayNameById, statsById] = await Promise.all([
        nameResolver(candidateUserIds),
        getAnswerStatsByUser(candidateUserIds),
      ])

      leaderboard = sparkRows.map((r) => ({
        userId: r.userId,
        displayName: displayNameById[r.userId] || 'User',
        score: r.score,
        answersCount: statsById[r.userId]?.answersCount || 0,
        upvotesReceived: statsById[r.userId]?.upvotesReceived || 0,
      }))
    }

    res.json({ success: true, leaderboard })
  } catch (error) {
    next(error)
  }
}
