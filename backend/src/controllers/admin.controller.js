import { validationResult } from 'express-validator'
import argon2 from 'argon2'
import Answer from '../models/answer.model.js'
import Approval from '../models/approval.model.js'
import Comment from '../models/comment.model.js'
import Flag from '../models/flag.model.js'
import Notification from '../models/notification.model.js'
import Question from '../models/question.model.js'
import FAQQuestion from '../models/faq.model.js'
import Role from '../models/role.model.js'
import SparkTransaction from '../models/spark-transaction.model.js'
import Tag from '../models/tag.model.js'
import UserProfile from '../models/user-profile.model.js'
import UserRoleMapper from '../models/user-role-mapper.model.js'
import User from '../models/user.model.js'
import { validatePassword } from './auth.controller.js'
import {
  ensureRole,
  getMappedRoles,
  getPrimaryRole,
  normalizeRoleName,
} from '../services/role.service.js'
import {
  getPlatformSettings,
  updatePlatformSettingsSection,
} from '../services/platform-settings.service.js'
import {
  buildLeaderboardRows,
  computeScore,
  getContributorStats,
} from '../services/leaderboard.service.js'
import {
  createHttpError,
  getCreatedAtFilter,
  getPagination,
  paginationResult,
} from '../utils/http.js'

async function syncUserPrimaryRole(userId) {
  let roles = await getMappedRoles(userId)

  if (!roles.length) {
    const userRole = await ensureRole('USER')
    await UserRoleMapper.create({ user_id: userId, role_id: userRole.role_id })
    roles = ['USER']
  }

  return getPrimaryRole(roles)
}

/**
 * Returns an array of { hour, questions, answers, comments } objects
 * bucketed by the hour for the last 24h from since24h.
 */
async function hourlyTrafficAggregation(since24h) {
  // Aggregate questions per hour
  const [qAgg, aAgg, cAgg] = await Promise.all([
    Question.aggregate([
      { $match: { created_at: { $gte: since24h } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$created_at' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Answer.aggregate([
      { $match: { created_at: { $gte: since24h } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$created_at' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Comment.aggregate([
      { $match: { created_at: { $gte: since24h } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$created_at' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ])

  // Build hour → count maps
  const qMap = Object.fromEntries(qAgg.map(r => [r._id, r.count]))
  const aMap = Object.fromEntries(aAgg.map(r => [r._id, r.count]))
  const cMap = Object.fromEntries(cAgg.map(r => [r._id, r.count]))

  // Collect all unique hours across the three series, sorted
  const allHours = [...new Set([...qAgg.map(r => r._id), ...aAgg.map(r => r._id), ...cAgg.map(r => r._id)])].sort()

  return allHours.map(hour => ({
    hour,                          // e.g. "2026-05-31 22:00"
    questions: qMap[hour] ?? 0,
    answers: (aMap[hour] ?? 0) + (cMap[hour] ?? 0),
    comments: cMap[hour] ?? 0,
  }))
}

export async function getAdminDashboard(req, res, next) {
  try {
    const createdAt = getCreatedAtFilter(req.query.from, req.query.to)
    const periodFilter = createdAt ? { created_at: createdAt } : {}
    const openFlagFilter = { ...periodFilter, status: 'pending' }

    const now = new Date()
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const since24h = new Date(now - 24 * 60 * 60 * 1000)

    const [
      totalUsers, usersThisWeek, usersThisMonth,
      totalQuestions, questionsByKind,
      seekApprovalCount,
      approvedCount,
      openFlags,
      totalSparks,
      recentQuestions,
      recentUsers,
      recentFlags,
      timeToResolveRaw,
      answersByRoleRaw,
      tagStats,
      hourlyTraffic,
    ] = await Promise.all([
      User.countDocuments(periodFilter),
      User.countDocuments({ ...periodFilter, created_at: { $gte: weekAgo } }),
      User.countDocuments({ ...periodFilter, created_at: { $gte: monthAgo } }),
      Question.countDocuments(periodFilter),
      Question.aggregate([
        { $match: periodFilter },
        { $group: { _id: '$kind', count: { $sum: 1 } } },
      ]),
      Question.countDocuments({ approval_status: 'pending' }),
      Question.countDocuments({ approval_status: 'approved' }),
      Flag.countDocuments(openFlagFilter),
      SparkTransaction.aggregate([
        { $match: periodFilter.created_at ? { created_at: periodFilter.created_at } : {} },
        { $group: { _id: null, total: { $sum: '$points' } } },
      ]),
      Question.find(periodFilter)
        .sort({ created_at: -1 })
        .limit(5)
        .select('question_id title kind status created_at author_id')
        .lean(),
      User.find(periodFilter)
        .sort({ created_at: -1 })
        .limit(5)
        .select('user_id name email status created_at')
        .lean(),
      Flag.find({ ...openFlagFilter })
        .sort({ created_at: -1 })
        .limit(5)
        .lean(),
      Question.aggregate([
        { $match: { ...periodFilter, status: 'closed' } },
        { $project: { timeDiffMs: { $subtract: ['$updated_at', '$created_at'] } } },
        { $project: { timeDiffHours: { $divide: ['$timeDiffMs', 3600000] } } },
        {
          $bucket: {
            groupBy: '$timeDiffHours',
            boundaries: [0, 1, 4, 24],
            default: 'Over 24h',
            output: { count: { $sum: 1 } },
          },
        },
      ]),
      Answer.aggregate([
        { $match: periodFilter },
        { $group: { _id: '$author_role', count: { $sum: 1 } } }
      ]),
      Question.aggregate([
        { $match: { ...periodFilter, tags: { $exists: true, $ne: [] } } },
        { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$tags',
            total: { $sum: 1 },
            resolved: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['closed', 'archived', 'removed']] },
                  1, 0,
                ],
              },
            },
          },
        },
        { $project: { _id: 0, tag: '$_id', total: 1, new: { $subtract: ['$total', '$resolved'] }, resolved: 1 } },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),
      hourlyTrafficAggregation(since24h),
    ])

    const recentUserIds = recentUsers.map((u) => u.user_id)
    const recentProfiles = await UserProfile.find({ user_id: { $in: recentUserIds } }).select('user_id display_name').lean()
    const profileMap = Object.fromEntries(recentProfiles.map((p) => [p.user_id, p.display_name]))
    const recentUsersWithProfileNames = recentUsers.map((u) => ({
      ...u,
      name: profileMap[u.user_id] || u.name,
    }))

    const sparkTotal = totalSparks[0]?.total ?? 0
    const kindMap = Object.fromEntries(questionsByKind.map((k) => [k._id, k.count]))

    res.json({
      success: true,
      metrics: {
        users: {
          total: totalUsers,
          thisWeek: usersThisWeek,
          thisMonth: usersThisMonth,
        },
        questions: {
          total: totalQuestions,
          faq: kindMap.faq ?? 0,
          community: kindMap.community ?? 0,
        },
        seekApproval: { total: seekApprovalCount },
        approvedCount: { total: approvedCount },
        flags: { open: openFlags },
        sparks: { total: sparkTotal },
      },
      recent: {
        questions: recentQuestions,
        users: recentUsersWithProfileNames,
        flags: recentFlags,
      },
      charts: {
        resolutionSpeed: timeToResolveRaw.map(b => {
          let label = ''
          if (b._id === 0) label = '< 1h'
          else if (b._id === 1) label = '1-4h'
          else if (b._id === 4) label = '4-24h'
          else label = '> 24h'
          return { name: label, count: b.count }
        }),
        supportLoad: answersByRoleRaw.map(a => ({
          name: (a._id || 'USER').toUpperCase(),
          value: a.count,
        })),
        categories: tagStats.map(t => ({
          category: t.tag.charAt(0).toUpperCase() + t.tag.slice(1),
          total: t.total,
          new: t.new,
          resolved: t.resolved,
        })),
      },
      last24h: hourlyTraffic,
    })
  } catch (error) {
    next(error)
  }
}

export async function getAdminSettings(_req, res, next) {
  try {
    const settings = await getPlatformSettings()
    res.json({ success: true, settings })
  } catch (error) {
    next(error)
  }
}

export async function updateAdminSettings(req, res, next) {
  try {
    const settings = await updatePlatformSettingsSection(
      req.params.section,
      req.body,
      req.user.userId,
    )

    res.json({
      success: true,
      message: 'Settings updated',
      settings,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Preview the leaderboard with candidate weights — returns the projected top-N
 * entries alongside the current top-N so the admin can see rank shifts before
 * saving.
 *
 * POST /api/admin/settings/leaderboard/preview
 * Body: { weights: { ...leaderboard weights }, limit?: number }
 */
export async function previewLeaderboardWeights(req, res, next) {
  try {
    const { weights: candidateWeights, limit = 20 } = req.body

    if (!candidateWeights || typeof candidateWeights !== 'object') {
      throw createHttpError(400, 'weights object is required')
    }

    const settings = await getPlatformSettings()
    const currentWeights = settings.leaderboard

    // Get the top users by spark_points to preview — representative sample
    const users = await User.find()
      .sort({ spark_points: -1 })
      .limit(Math.min(Number(limit) || 20, 100))
      .select('user_id name spark_points')
      .lean()

    const userIds = users.map((u) => u.user_id)
    if (!userIds.length) {
      return res.json({ success: true, current: [], projected: [] })
    }

    const statsById = await getContributorStats(userIds)
    for (const user of users) {
      if (statsById[user.user_id]) {
        statsById[user.user_id].sparkPoints = user.spark_points || 0
      }
    }

    const usersWithStats = users.map((u) => ({ user: u, stats: statsById[u.user_id] || {} }))

    const current = buildLeaderboardRows(usersWithStats, currentWeights)
    const projected = buildLeaderboardRows(usersWithStats, candidateWeights)

    // Attach rank to each entry
    const withRank = (rows) =>
      rows.map((r, i) => ({ ...r, rank: i + 1 }))

    // Annotate each projected row with rank change vs current
    const currentById = Object.fromEntries(current.map((r) => [r.userId, r]))
    const enriched = withRank(projected).map((r) => ({
      ...r,
      rankChange: currentById[r.userId]
        ? currentById[r.userId].rank - r.rank
        : 0,
      currentScore: currentById[r.userId]
        ? currentById[r.userId].score
        : null,
    }))

    res.json({
      success: true,
      current: withRank(current).slice(0, limit),
      projected: enriched.slice(0, limit),
      weightDiff: Object.fromEntries(
        Object.keys(candidateWeights).map((k) => [
          k,
          {
            from: currentWeights[k] ?? 0,
            to: candidateWeights[k] ?? 0,
          },
        ]),
      ),
    })
  } catch (error) {
    next(error)
  }
}

export async function assignUserRole(req, res, next) {
  try {
    const roleName = normalizeRoleName(req.body.role)

    if (!roleName) {
      throw createHttpError(400, 'Role must be USER, RESOLVER, or ADMIN')
    }

    const [user, role] = await Promise.all([
      User.findOne({ user_id: req.params.userId }),
      Role.findOne({ name: roleName.toLowerCase() }),
    ])

    if (!user || !role) {
      throw createHttpError(404, 'User or role not found')
    }

    const exists = await UserRoleMapper.exists({
      user_id: user.user_id,
      role_id: role.role_id,
    })

    if (exists) {
      throw createHttpError(409, 'Role already assigned')
    }

    await UserRoleMapper.create({ user_id: user.user_id, role_id: role.role_id })
    await syncUserPrimaryRole(user.user_id)

    await Notification.create({
      recipient_id: user.user_id,
      actor_id: req.user.userId,
      type: 'account_status',
      title: 'Role assigned',
      body: `You have been assigned the ${roleName} role.`,
      reference_id: user.user_id,
      reference_type: 'user',
    })

    res.status(201).json({ success: true, message: 'Role assigned' })
  } catch (error) {
    next(error)
  }
}

export async function removeUserRole(req, res, next) {
  try {
    const roleName = normalizeRoleName(req.params.roleName)

    if (!roleName) {
      throw createHttpError(400, 'Invalid role')
    }

    const role = await Role.findOne({ name: roleName.toLowerCase() })

    if (!role) {
      throw createHttpError(404, 'User role mapping not found')
    }

    const mapping = await UserRoleMapper.findOne({
      user_id: req.params.userId,
      role_id: role.role_id,
    })

    if (!mapping) {
      throw createHttpError(404, 'User role mapping not found')
    }

    if (roleName === 'ADMIN') {
      const adminCount = await UserRoleMapper.countDocuments({ role_id: role.role_id })

      if (adminCount <= 1) {
        throw createHttpError(409, 'Cannot remove final admin role')
      }
    }

    await mapping.deleteOne()
    await syncUserPrimaryRole(req.params.userId)

    await Notification.create({
      recipient_id: req.params.userId,
      actor_id: req.user.userId,
      type: 'account_status',
      title: 'Role removed',
      body: `Your ${roleName} role has been removed.`,
      reference_id: req.params.userId,
      reference_type: 'user',
    })

    res.json({ success: true, message: 'Role removed' })
  } catch (error) {
    next(error)
  }
}

export async function listAdminSparkTransactions(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query)
    const filter = {}
    const createdAt = getCreatedAtFilter(req.query.from, req.query.to)

    if (req.query.userId) {
      filter.user_id = req.query.userId
    }

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

export async function createUser(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createHttpError(400, errors.array()[0].msg)
    }

    const { name, email, password, role } = req.body

    const existing = await User.findOne({ email: email.trim().toLowerCase() })
    if (existing) {
      throw createHttpError(409, 'A user with that email already exists')
    }

    validatePassword(password)

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: await argon2.hash(password),
    })

    const userRole = await ensureRole('USER')
    await UserRoleMapper.create({ user_id: user.user_id, role_id: userRole.role_id })
    await UserProfile.create({ user_id: user.user_id, display_name: user.name })

    if (role && typeof role === 'string') {
      const normalizedRole = normalizeRoleName(role)
      if (normalizedRole && normalizedRole !== 'USER') {
        const roleDoc = await Role.findOne({ name: normalizedRole })
        if (roleDoc) {
          await UserRoleMapper.create({ user_id: user.user_id, role_id: roleDoc.role_id })
          await Notification.create({
            recipient_id: user.user_id,
            actor_id: req.user.userId,
            type: 'account_status',
            title: 'Account created',
            body: `Your ${normalizedRole} role was set when your account was created.`,
            reference_id: user.user_id,
            reference_type: 'user',
          })
        }
      }
    }

    const roles = await getMappedRoles(user.user_id)

    res.status(201).json({
      success: true,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        roles,
        status: user.status,
        sparkPoints: user.spark_points,
        createdAt: user.created_at,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function listTags(req, res, next) {
  try {
    const { page = 1, limit = 50 } = getPagination(req)
    const skip = (Number(page) - 1) * Number(limit)

    const [tags, total] = await Promise.all([
      Tag.find({}).sort({ questionCount: -1, name: 1 }).skip(skip).limit(Number(limit)),
      Tag.countDocuments({}),
    ])

    res.json({
      success: true,
      tags,
      pagination: paginationResult(page, limit, total),
    })
  } catch (error) {
    next(error)
  }
}

export async function createTag(req, res, next) {
  try {
    const { name, description = '' } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw createHttpError(400, 'Tag name is required')
    }
    const normalized = name.trim().toLowerCase()
    if (normalized.length > 30) {
      throw createHttpError(400, 'Tag name must be 30 characters or fewer')
    }
    const existing = await Tag.findOne({ name: normalized })
    if (existing) {
      throw createHttpError(409, 'Tag already exists')
    }
    const displayName = normalized.charAt(0).toUpperCase() + normalized.slice(1)
    const tag = await Tag.create({ name: normalized, displayName, description: description.trim() })
    res.status(201).json({ success: true, tag })
  } catch (error) {
    next(error)
  }
}

export async function renameTag(req, res, next) {
  try {
    const { tagName } = req.params
    const { name: newName } = req.body
    if (!newName || typeof newName !== 'string' || !newName.trim()) {
      throw createHttpError(400, 'New tag name is required')
    }
    const normalized = newName.trim().toLowerCase()
    if (normalized.length > 30) {
      throw createHttpError(400, 'Tag name must be 30 characters or fewer')
    }
    if (normalized === tagName) {
      return res.json({ success: true })
    }
    const [oldTag, existing] = await Promise.all([
      Tag.findOne({ name: tagName }),
      Tag.findOne({ name: normalized }),
    ])
    if (!oldTag) {
      throw createHttpError(404, 'Tag not found')
    }
    if (existing) {
      throw createHttpError(409, 'A tag with that name already exists')
    }
    // Update all questions that have this tag
    await Question.updateMany(
      { tags: tagName },
      { $set: { 'tags.$[elem]': normalized } },
      { arrayFilters: [{ elem: tagName }] },
    )
    // Recompute questionCount on the tag doc
    const newCount = await Question.countDocuments({ tags: normalized })
    const newDisplayName = normalized.charAt(0).toUpperCase() + normalized.slice(1)
    await Tag.updateOne({ name: tagName }, { name: normalized, displayName: newDisplayName, questionCount: newCount })
    const updated = await Tag.findOne({ name: normalized })
    res.json({ success: true, tag: updated })
  } catch (error) {
    next(error)
  }
}

export async function deleteTag(req, res, next) {
  try {
    const { tagName } = req.params
    const tag = await Tag.findOne({ name: tagName })
    if (!tag) {
      throw createHttpError(404, 'Tag not found')
    }
    // Remove this tag from all questions
    await Question.updateMany(
      { tags: tagName },
      { $pull: { tags: tagName } },
    )
    await tag.deleteOne()
    res.json({ success: true, removed: tagName })
  } catch (error) {
    next(error)
  }
}

/**
 * Post an admin response on a question and resolve it immediately. The answer is
 * authored by the acting admin but stamped `author_role: 'ADMIN'`, so the thread
 * shows "ADMIN" regardless of which admin posted it (their identity is not shown).
 */
export async function adminCommentAndResolve(req, res, next) {
  try {
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : ''

    if (!body) {
      throw createHttpError(400, 'Comment body is required')
    }

    const question = await Question.findOne({ question_id: req.params.questionId })

    if (!question || question.status === 'removed') {
      throw createHttpError(404, 'Question not found')
    }

    const answer = await Answer.create({
      question_id: question.question_id,
      author_id: req.user.userId,
      author_role: 'ADMIN',
      body,
      is_expert: true,
      is_official: true,
    })

    // Resolve immediately (mirrors acceptAnswer/resolveQuestion: status → closed).
    await Question.updateOne(
      { question_id: question.question_id },
      {
        $inc: { answer_count: 1 },
        $set: {
          status: 'closed',
          has_expert_answer: true,
          last_activity_at: new Date(),
        },
      },
    )

    if (question.author_id !== req.user.userId) {
      await Notification.create({
        recipient_id: question.author_id,
        actor_id: req.user.userId,
        type: 'answer',
        title: 'An admin resolved your question',
        body: `Your question "${question.title}" was answered and resolved by an admin.`,
        reference_id: question.question_id,
        reference_type: 'question',
      })
    }

    res.status(201).json({
      success: true,
      message: 'Comment posted and question resolved',
      answerId: answer.answer_id,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Seek approval from a higher authority for an unresolved query.
 */
export async function adminSeekApproval(req, res, next) {
  try {
    const { adminId, adminName } = req.body
    if (!adminId || !adminName) {
      throw createHttpError(400, 'Admin ID and Name are required')
    }

    // Validate adminId belongs to a real ADMIN user
    const targetAdmin = await User.findOne({ user_id: adminId })
    if (!targetAdmin) {
      throw createHttpError(404, 'Admin not found')
    }

    const question = await Question.findOne({ question_id: req.params.questionId })

    if (!question || question.status === 'removed') {
      throw createHttpError(404, 'Question not found')
    }

    // Prevent duplicate pending approvals for the same question
    const existingApproval = await Approval.findOne({
      question_id: question.question_id,
      status: 'pending',
    })
    if (existingApproval) {
      throw createHttpError(400, 'Approval already requested for this question')
    }

    await Question.updateOne(
      { question_id: question.question_id },
      {
        $set: {
          approval_requested_from: adminId,
          approval_requested_from_name: adminName,
          approval_status: 'pending',
        },
      },
    )

    await Approval.create({
      question_id: question.question_id,
      requested_by: req.user.userId,
      requested_from: adminId,
      requested_from_name: adminName,
      status: 'pending',
    })

    res.status(201).json({
      success: true,
      message: `Approval requested from ${adminName}`,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Mark a pending approval as received and clear the flag.
 */
export async function adminMarkApprovalReceived(req, res, next) {
  try {
    const question = await Question.findOne({ question_id: req.params.questionId })

    if (!question || question.status === 'removed') {
      throw createHttpError(404, 'Question not found')
    }

    if (!question.approval_requested_from) {
      throw createHttpError(400, 'This question is not currently under approval')
    }

    if (question.approval_requested_from !== req.user.userId) {
      throw createHttpError(403, 'Only the requested admin can mark approval')
    }

    // Update the most recent pending approval record
    await Approval.findOneAndUpdate(
      { question_id: question.question_id, status: 'pending' },
      { $set: { status: 'approved' } },
      { sort: { created_at: -1 } }
    )

    // Clear the flags from the question
    await Question.updateOne(
      { question_id: question.question_id },
      {
        $set: {
          approval_status: 'approved',
        },
      },
    )

    res.status(200).json({
      success: true,
      message: 'Approval marked as received',
    })
  } catch (error) {
    next(error)
  }
}


export async function exportQuestionToFAQ(req, res, next) {
  try {
    const { questionId } = req.params
    const { curatedTitle, curatedBody, tags } = req.body

    if (!curatedTitle || typeof curatedTitle !== 'string' || !curatedTitle.trim()) {
      throw createHttpError(400, 'Curated title is required')
    }
    const trimmedTitle = curatedTitle.trim()
    if (trimmedTitle.length < 10) {
      throw createHttpError(400, 'Title must be at least 10 characters long')
    }
    if (trimmedTitle.length > 300) {
      throw createHttpError(400, 'Title must be at most 300 characters long')
    }

    if (!curatedBody || typeof curatedBody !== 'string' || !curatedBody.trim()) {
      throw createHttpError(400, 'Curated body is required')
    }

    // Retrieve the original community question by question_id
    const question = await Question.findOne({ question_id: questionId })
    if (!question) {
      throw createHttpError(404, 'Original question not found')
    }

    // Generate unique slug
    let baseSlug = trimmedTitle
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'general'

    let slug = baseSlug
    let counter = 1
    while (await FAQQuestion.exists({ slug })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Create the new FAQ Question
    const faqQuestion = await FAQQuestion.create({
      title: trimmedTitle,
      body: curatedBody.trim(),
      tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
      slug,
      kind: 'faq',
      status: 'published',
      visibility: 'public',
      moderation_status: 'approved',
      author_id: req.user.userId,
      last_activity_at: new Date()
    })

    // Link original question to the new FAQ question
    await Question.updateOne(
      { question_id: questionId },
      { $set: { linked_faq_id: faqQuestion.question_id } }
    )

    res.status(201).json({
      success: true,
      message: 'Question successfully exported to FAQ',
      faq: faqQuestion
    })
  } catch (error) {
    next(error)
  }
}
