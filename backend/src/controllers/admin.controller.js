import { validationResult } from 'express-validator'
import argon2 from 'argon2'
import Answer from '../models/answer.model.js'
import Comment from '../models/comment.model.js'
import Flag from '../models/flag.model.js'
import Notification from '../models/notification.model.js'
import Question from '../models/question.model.js'
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
    answers: aMap[hour] ?? 0,
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
      totalAnswers,
      openFlags,
      totalSparks,
      recentQuestions,
      recentUsers,
      recentFlags,
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
      Answer.countDocuments(periodFilter),
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
      // Hourly traffic for last 24h — single pipeline that returns all three series
      hourlyTrafficAggregation(since24h),
    ])

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
        answers: { total: totalAnswers },
        flags: { open: openFlags },
        sparks: { total: sparkTotal },
      },
      recent: {
        questions: recentQuestions,
        users: recentUsers,
        flags: recentFlags,
      },
      charts: {
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
            user_id: user.user_id,
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
