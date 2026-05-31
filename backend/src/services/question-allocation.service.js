import Question from '../models/question.model.js'
import User from '../models/user.model.js'
import QuestionAssignmentLog from '../models/question-assignment-log.model.js'
import Notification from '../models/notification.model.js'
import { getPlatformSettings } from './platform-settings.service.js'
import { getUserIdsByRole } from './role.service.js'
import { appendFeatureLog } from '../utils/featureLogger.js'

const UNANSWERED_THRESHOLD_HOURS = 48

/**
 * Returns the number of open questions assigned to a resolver.
 */
async function getResolverLoad(resolverId) {
  return Question.countDocuments({
    assigned_to: resolverId,
    status: { $in: ['unanswered', 'answered', 'in_progress'] },
  })
}

/**
 * Returns the least-loaded active resolver, or null if none available.
 */
async function findLeastLoadedResolver(excludeIds = []) {
  const resolverIds = await getUserIdsByRole('RESOLVER')

  const resolvers = await User.find({
    user_id: { $in: resolverIds, $nin: excludeIds },
    status: 'active',
  }).select('user_id name email').lean()

  if (resolvers.length === 0) return null

  const loads = await Promise.all(
    resolvers.map(async r => ({
      user_id: r.user_id,
      name: r.name,
      email: r.email,
      load: await getResolverLoad(r.user_id),
    })),
  )

  loads.sort((a, b) => a.load - b.load)
  return loads[0]
}

async function getAdminEscalationCandidates({ assignmentStrategy, defaultAdminUserId }) {
  const adminIds = await getUserIdsByRole('ADMIN')

  const admins = await User.find({
    user_id: { $in: adminIds },
    status: 'active',
  }).select('user_id name email').lean()

  if (!admins.length) {
    return []
  }

  if (assignmentStrategy === 'default_admin' && defaultAdminUserId) {
    const defaultAdmin = admins.find((admin) => admin.user_id === defaultAdminUserId)
    if (defaultAdmin) {
      return [defaultAdmin]
    }
  }

  const loads = await Promise.all(
    admins.map(async admin => ({
      ...admin,
      load: await Question.countDocuments({
        assigned_to: admin.user_id,
        status: { $in: ['unanswered', 'answered'] },
      }),
    })),
  )

  loads.sort((a, b) => a.load - b.load || a.user_id.localeCompare(b.user_id))
  return loads
}

async function escalateUnresolvedQuestionsToAdmin(settings) {
  const config = settings.questionEscalation

  if (!config.automaticEscalationEnabled) {
    return { escalated: 0, skipped: 0, errors: 0 }
  }

  const adminIds = await getUserIdsByRole('ADMIN')
  const candidates = await getAdminEscalationCandidates(config)

  if (!candidates.length) {
    await appendFeatureLog({
      event: 'ADMIN_ESCALATION_SKIPPED',
      reason: 'no_active_admins',
      timestamp: new Date().toISOString(),
    })
    return { escalated: 0, skipped: 1, errors: 0 }
  }

  const cutoff = new Date(Date.now() - config.unresolvedHoursToEscalate * 60 * 60 * 1000)
  const unresolvedStatuses = config.includeCommentedUnresolved
    ? ['unanswered', 'answered']
    : ['unanswered']

  const questions = await Question.find({
    status: { $in: unresolvedStatuses },
    kind: 'community',
    assigned_to: { $nin: adminIds },
    created_at: { $lt: cutoff },
  })
    .sort({ created_at: 1 })
    .lean()

  let escalated = 0
  let skipped = 0
  let errors = 0

  for (const [index, question] of questions.entries()) {
    try {
      const admin = config.assignmentStrategy === 'round_robin_admin'
        ? candidates[index % candidates.length]
        : candidates[0]

      const result = await Question.updateOne(
        { _id: question._id, assigned_to: { $nin: adminIds } },
        { assigned_to: admin.user_id },
      )

      if (result.modifiedCount === 0) {
        skipped++
        continue
      }

      const queuedDurationHrs = Math.round(
        (Date.now() - new Date(question.created_at).getTime()) / (1000 * 60 * 60),
      )

      await QuestionAssignmentLog.create({
        question_id: question.question_id,
        resolver_id: admin.user_id,
        assigned_by: 'SYSTEM',
        reason: `auto-admin-escalation-${config.unresolvedHoursToEscalate}h`,
        assigned_at: new Date(),
      })

      await Notification.create({
        recipient_id: admin.user_id,
        type: 'account_status',
        title: 'Question Escalated',
        body: `Question "${question.title}" is unresolved after ${queuedDurationHrs} hours and has been escalated to admin review.`,
        reference_id: question.question_id,
        reference_type: 'question',
        link: `/query/${question.question_id}`,
      })

      await appendFeatureLog({
        event: 'ADMIN_ESCALATION',
        question_id: question.question_id,
        admin_id: admin.user_id,
        admin_name: admin.name,
        queued_duration_hrs: queuedDurationHrs,
        timestamp: new Date().toISOString(),
      })

      escalated++
    } catch (err) {
      await appendFeatureLog({
        event: 'ADMIN_ESCALATION_ERROR',
        question_id: question.question_id,
        error: err.message,
        timestamp: new Date().toISOString(),
      })
      errors++
    }
  }

  return { escalated, skipped, errors }
}

/**
 * Main allocation function.
 * Finds all unanswered community questions older than 48h with no resolver,
 * then assigns each to the least-loaded resolver.
 *
 * Returns a summary object for logging.
 */
export async function allocateUnansweredQuestions() {
  const settings = await getPlatformSettings()
  const escalationResult = await escalateUnresolvedQuestionsToAdmin(settings)
  const cutoff = new Date(Date.now() - UNANSWERED_THRESHOLD_HOURS * 60 * 60 * 1000)

  const unassigned = await Question.find({
    status: 'unanswered',
    kind: 'community',
    assigned_to: null,
    created_at: { $lt: cutoff },
  })
    .sort({ created_at: 1 })
    .lean()

  if (unassigned.length === 0) {
    await appendFeatureLog({
      event: 'NO_ASSIGNMENT_NEEDED',
      count: 0,
      timestamp: new Date().toISOString(),
    })
    return {
      assigned: 0,
      skipped: escalationResult.skipped,
      errors: escalationResult.errors,
      escalated: escalationResult.escalated,
    }
  }

  let assigned = 0
  let skipped = escalationResult.skipped
  let errors = escalationResult.errors
  const assignedResolverIds = new Set()

  for (const question of unassigned) {
    try {
      // Exclude resolvers who already got an assignment this run (spread load)
      const excludeIds = Array.from(assignedResolverIds)
      const resolver = await findLeastLoadedResolver(excludeIds)

      if (!resolver) {
        await appendFeatureLog({
          event: 'RESOLVER_UNAVAILABLE',
          question_id: question.question_id,
          reason: 'no_active_resolvers',
          timestamp: new Date().toISOString(),
        })
        skipped++
        continue
      }

      const queuedDurationHrs = Math.round(
        (Date.now() - new Date(question.created_at).getTime()) / (1000 * 60 * 60),
      )

      // Update question
      await Question.updateOne(
        { _id: question._id },
        { assigned_to: resolver.user_id },
      )

      // Audit log
      await QuestionAssignmentLog.create({
        question_id: question.question_id,
        resolver_id: resolver.user_id,
        assigned_by: 'SYSTEM',
        reason: 'auto-unanswered-48h',
        assigned_at: new Date(),
      })

      // Notification to resolver
      await Notification.create({
        recipient_id: resolver.user_id,
        type: 'account_status',
        title: 'Question Auto-Assigned',
        body: `Question "${question.title}" has been auto-assigned to you. It was posted ${queuedDurationHrs} hours ago.`,
        reference_id: question.question_id,
        reference_type: 'question',
        link: `/query/${question.question_id}`,
      })

      assignedResolverIds.add(resolver.user_id)

      await appendFeatureLog({
        event: 'ASSIGNMENT',
        question_id: question.question_id,
        resolver_id: resolver.user_id,
        resolver_name: resolver.name,
        assigned_by: 'SYSTEM',
        queued_duration_hrs: queuedDurationHrs,
        timestamp: new Date().toISOString(),
      })

      assigned++
    } catch (err) {
      await appendFeatureLog({
        event: 'ERROR',
        question_id: question.question_id,
        error: err.message,
        timestamp: new Date().toISOString(),
      })
      errors++
    }
  }

  return { assigned, skipped, errors, escalated: escalationResult.escalated }
}
