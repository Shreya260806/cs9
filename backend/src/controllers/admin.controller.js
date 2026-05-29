import Answer from '../models/answer.model.js'
import Flag from '../models/flag.model.js'
import Notification from '../models/notification.model.js'
import Question from '../models/question.model.js'
import Role from '../models/role.model.js'
import SparkTransaction from '../models/spark-transaction.model.js'
import UserRoleMapper from '../models/user-role-mapper.model.js'
import User from '../models/user.model.js'
import {
  ensureRole,
  getMappedRoles,
  getPrimaryRole,
  normalizeRoleName,
} from '../services/role.service.js'
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

export async function getAdminDashboard(req, res, next) {
  try {
    const createdAt = getCreatedAtFilter(req.query.from, req.query.to)
    const periodFilter = createdAt ? { created_at: createdAt } : {}
    const openFlagFilter = { ...periodFilter, status: 'pending' }

    const now = new Date()
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)

    const [
      totalUsers, usersThisWeek, usersThisMonth,
      totalQuestions, questionsByKind,
      totalAnswers,
      openFlags,
      totalSparks,
      recentQuestions,
      recentUsers,
      recentFlags,
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
        { $match: { created_at: periodFilter.created_at || {} } },
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
