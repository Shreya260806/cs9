import PlatformSettings from '../models/platform-settings.model.js'
import { createHttpError } from '../utils/http.js'

const SETTINGS_ID = 'platform'

export const DEFAULT_PLATFORM_SETTINGS = {
  leaderboard: {
    questionsAskedWeight: 0,
    answersGivenWeight: 0,
    commentsGivenWeight: 0,
    acceptedResolutionsWeight: 0,
    upvotesReceivedWeight: 0,
    resolverActivityWeight: 0,
    sparkPointsWeight: 0,
    reputationWeight: 1,
    warningPenaltyWeight: 0,
  },
  userThresholds: {
    resolverEligibility: {
      minAnswersOrComments: 10,
      minUpheldContributions: 3,
      minSuccessfulResolverActions: 5,
      minAcceptedResolutions: 2,
      minReputationScore: 100,
      minSparkPoints: 50,
    },
    moderationThresholds: {
      warningsBeforeInactive: 3,
      rejectedContentReviewThreshold: 5,
      negativeFlagsBeforeAction: 3,
      autoDeactivateOnWarningThreshold: false,
      inactivityDaysBeforeReview: 90,
    },
  },
  questionEscalation: {
    unresolvedHoursToEscalate: 72,
    automaticEscalationEnabled: false,
    includeCommentedUnresolved: true,
    reminderHoursBeforeEscalation: 24,
    assignmentStrategy: 'any_admin',
    defaultAdminUserId: '',
  },
}

const SECTION_PATHS = {
  leaderboard: 'leaderboard',
  userThresholds: 'userThresholds',
  questionEscalation: 'questionEscalation',
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge(base, override = {}) {
  const result = { ...base }

  for (const [key, value] of Object.entries(override || {})) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = deepMerge(base[key], value)
    } else if (value !== undefined) {
      result[key] = value
    }
  }

  return result
}

function requireNumber(value, path, { integer = false, min = 0 } = {}) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value

  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw createHttpError(400, `${path} must be a valid number`)
  }
  if (integer && !Number.isInteger(number)) {
    throw createHttpError(400, `${path} must be a whole number`)
  }
  if (number < min) {
    throw createHttpError(400, `${path} must be at least ${min}`)
  }

  return number
}

function requireBoolean(value, path) {
  if (typeof value !== 'boolean') {
    throw createHttpError(400, `${path} must be true or false`)
  }
  return value
}

function sanitizeLeaderboard(input) {
  return {
    questionsAskedWeight: requireNumber(input.questionsAskedWeight, 'questionsAskedWeight'),
    answersGivenWeight: requireNumber(input.answersGivenWeight, 'answersGivenWeight'),
    commentsGivenWeight: requireNumber(input.commentsGivenWeight, 'commentsGivenWeight'),
    acceptedResolutionsWeight: requireNumber(input.acceptedResolutionsWeight, 'acceptedResolutionsWeight'),
    upvotesReceivedWeight: requireNumber(input.upvotesReceivedWeight, 'upvotesReceivedWeight'),
    resolverActivityWeight: requireNumber(input.resolverActivityWeight, 'resolverActivityWeight'),
    sparkPointsWeight: requireNumber(input.sparkPointsWeight, 'sparkPointsWeight'),
    reputationWeight: requireNumber(input.reputationWeight, 'reputationWeight'),
    warningPenaltyWeight: requireNumber(input.warningPenaltyWeight, 'warningPenaltyWeight'),
  }
}

function sanitizeUserThresholds(input) {
  return {
    resolverEligibility: {
      minAnswersOrComments: requireNumber(
        input.resolverEligibility?.minAnswersOrComments,
        'resolverEligibility.minAnswersOrComments',
        { integer: true },
      ),
      minUpheldContributions: requireNumber(
        input.resolverEligibility?.minUpheldContributions,
        'resolverEligibility.minUpheldContributions',
        { integer: true },
      ),
      minSuccessfulResolverActions: requireNumber(
        input.resolverEligibility?.minSuccessfulResolverActions,
        'resolverEligibility.minSuccessfulResolverActions',
        { integer: true },
      ),
      minAcceptedResolutions: requireNumber(
        input.resolverEligibility?.minAcceptedResolutions,
        'resolverEligibility.minAcceptedResolutions',
        { integer: true },
      ),
      minReputationScore: requireNumber(
        input.resolverEligibility?.minReputationScore,
        'resolverEligibility.minReputationScore',
        { integer: true },
      ),
      minSparkPoints: requireNumber(
        input.resolverEligibility?.minSparkPoints,
        'resolverEligibility.minSparkPoints',
        { integer: true },
      ),
    },
    moderationThresholds: {
      warningsBeforeInactive: requireNumber(
        input.moderationThresholds?.warningsBeforeInactive,
        'moderationThresholds.warningsBeforeInactive',
        { integer: true },
      ),
      rejectedContentReviewThreshold: requireNumber(
        input.moderationThresholds?.rejectedContentReviewThreshold,
        'moderationThresholds.rejectedContentReviewThreshold',
        { integer: true },
      ),
      negativeFlagsBeforeAction: requireNumber(
        input.moderationThresholds?.negativeFlagsBeforeAction,
        'moderationThresholds.negativeFlagsBeforeAction',
        { integer: true },
      ),
      autoDeactivateOnWarningThreshold: requireBoolean(
        input.moderationThresholds?.autoDeactivateOnWarningThreshold,
        'moderationThresholds.autoDeactivateOnWarningThreshold',
      ),
      inactivityDaysBeforeReview: requireNumber(
        input.moderationThresholds?.inactivityDaysBeforeReview,
        'moderationThresholds.inactivityDaysBeforeReview',
        { integer: true },
      ),
    },
  }
}

function sanitizeQuestionEscalation(input) {
  const unresolvedHoursToEscalate = requireNumber(
    input.unresolvedHoursToEscalate,
    'unresolvedHoursToEscalate',
    { integer: true, min: 1 },
  )
  const reminderHoursBeforeEscalation = requireNumber(
    input.reminderHoursBeforeEscalation,
    'reminderHoursBeforeEscalation',
    { integer: true },
  )

  if (reminderHoursBeforeEscalation > unresolvedHoursToEscalate) {
    throw createHttpError(400, 'reminderHoursBeforeEscalation must not exceed unresolvedHoursToEscalate')
  }

  if (!['any_admin', 'round_robin_admin', 'default_admin'].includes(input.assignmentStrategy)) {
    throw createHttpError(400, 'assignmentStrategy must be any_admin, round_robin_admin, or default_admin')
  }

  return {
    unresolvedHoursToEscalate,
    automaticEscalationEnabled: requireBoolean(
      input.automaticEscalationEnabled,
      'automaticEscalationEnabled',
    ),
    includeCommentedUnresolved: requireBoolean(
      input.includeCommentedUnresolved,
      'includeCommentedUnresolved',
    ),
    reminderHoursBeforeEscalation,
    assignmentStrategy: input.assignmentStrategy,
    defaultAdminUserId: typeof input.defaultAdminUserId === 'string'
      ? input.defaultAdminUserId.trim()
      : '',
  }
}

function sanitizeSection(section, input) {
  if (section === 'leaderboard') return sanitizeLeaderboard(input)
  if (section === 'userThresholds') return sanitizeUserThresholds(input)
  if (section === 'questionEscalation') return sanitizeQuestionEscalation(input)
  throw createHttpError(404, 'Settings section not found')
}

function serializeSettings(document) {
  const value = document?.toObject ? document.toObject() : document
  const merged = deepMerge(DEFAULT_PLATFORM_SETTINGS, {
    leaderboard: value?.leaderboard,
    userThresholds: value?.userThresholds,
    questionEscalation: value?.questionEscalation,
  })

  return {
    ...merged,
    updatedBy: value?.updated_by || null,
    updatedAt: value?.updated_at || value?.created_at || null,
  }
}

export async function getPlatformSettings() {
  let document = await PlatformSettings.findOne({ settings_id: SETTINGS_ID })

  if (!document) {
    try {
      document = await PlatformSettings.create({ settings_id: SETTINGS_ID })
    } catch (error) {
      if (error.code === 11000) {
        document = await PlatformSettings.findOne({ settings_id: SETTINGS_ID })
      } else {
        throw error
      }
    }
  }

  return serializeSettings(document)
}

export async function updatePlatformSettingsSection(section, updates, adminId) {
  const path = SECTION_PATHS[section]
  if (!path) {
    throw createHttpError(404, 'Settings section not found')
  }

  const current = await getPlatformSettings()
  const nextSection = sanitizeSection(section, deepMerge(current[path], updates))

  const document = await PlatformSettings.findOneAndUpdate(
    { settings_id: SETTINGS_ID },
    {
      $set: {
        [path]: nextSection,
        updated_by: adminId,
      },
      $setOnInsert: { settings_id: SETTINGS_ID },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )

  return serializeSettings(document)
}
