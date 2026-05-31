import mongoose from 'mongoose'

const leaderboardSettingsSchema = new mongoose.Schema(
  {
    questionsAskedWeight: { type: Number, min: 0, default: 0 },
    answersGivenWeight: { type: Number, min: 0, default: 0 },
    commentsGivenWeight: { type: Number, min: 0, default: 0 },
    acceptedResolutionsWeight: { type: Number, min: 0, default: 0 },
    upvotesReceivedWeight: { type: Number, min: 0, default: 0 },
    resolverActivityWeight: { type: Number, min: 0, default: 0 },
    sparkPointsWeight: { type: Number, min: 0, default: 0 },
    reputationWeight: { type: Number, min: 0, default: 1 },
    warningPenaltyWeight: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
)

const resolverEligibilitySchema = new mongoose.Schema(
  {
    minAnswersOrComments: { type: Number, min: 0, default: 10 },
    minUpheldContributions: { type: Number, min: 0, default: 3 },
    minSuccessfulResolverActions: { type: Number, min: 0, default: 5 },
    minAcceptedResolutions: { type: Number, min: 0, default: 2 },
    minReputationScore: { type: Number, min: 0, default: 100 },
    minSparkPoints: { type: Number, min: 0, default: 50 },
  },
  { _id: false },
)

const moderationThresholdSchema = new mongoose.Schema(
  {
    warningsBeforeInactive: { type: Number, min: 0, default: 3 },
    rejectedContentReviewThreshold: { type: Number, min: 0, default: 5 },
    negativeFlagsBeforeAction: { type: Number, min: 0, default: 3 },
    autoDeactivateOnWarningThreshold: { type: Boolean, default: false },
    inactivityDaysBeforeReview: { type: Number, min: 0, default: 90 },
  },
  { _id: false },
)

const userThresholdSettingsSchema = new mongoose.Schema(
  {
    resolverEligibility: {
      type: resolverEligibilitySchema,
      default: () => ({}),
    },
    moderationThresholds: {
      type: moderationThresholdSchema,
      default: () => ({}),
    },
  },
  { _id: false },
)

const questionEscalationSettingsSchema = new mongoose.Schema(
  {
    unresolvedHoursToEscalate: { type: Number, min: 1, default: 72 },
    automaticEscalationEnabled: { type: Boolean, default: false },
    includeCommentedUnresolved: { type: Boolean, default: true },
    reminderHoursBeforeEscalation: { type: Number, min: 0, default: 24 },
    assignmentStrategy: {
      type: String,
      enum: ['any_admin', 'round_robin_admin', 'default_admin'],
      default: 'any_admin',
    },
    defaultAdminUserId: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

const platformSettingsSchema = new mongoose.Schema(
  {
    settings_id: {
      type: String,
      default: 'platform',
      immutable: true,
      unique: true,
      index: true,
    },
    leaderboard: {
      type: leaderboardSettingsSchema,
      default: () => ({}),
    },
    userThresholds: {
      type: userThresholdSettingsSchema,
      default: () => ({}),
    },
    questionEscalation: {
      type: questionEscalationSettingsSchema,
      default: () => ({}),
    },
    updated_by: String,
  },
  {
    collection: 'platform_settings',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
)

export default mongoose.model('PlatformSettings', platformSettingsSchema)
