import SparkTransaction from '../models/spark-transaction.model.js'
import User from '../models/user.model.js'
import UserProfile from '../models/user-profile.model.js'
import { createHttpError } from '../utils/http.js'

export const SPARK_POINTS = {
  SUBMIT_QUESTION: 2,
  SUBMIT_ANSWER: 5,
  ANSWER_UPVOTED: 3,
  ANSWER_ACCEPTED: 15,
  ADD_REFERENCE: 5,
  DAILY_LOGIN: 1,
  EXPERT_VERIFIED: 20,
  QUESTION_BOUNTY: null,   // negative, set dynamically in reserveBounty
  BOUNTY_AWARDED: null,    // positive, set dynamically from question.spark_bounty
}

// Spark ownership rule:
// - spark_transactions is the ledger/source of truth.
// - users.spark_points is a cache balance owned by this service and the
//   spark reconciliation script only.
// Reputation = a trust/quality signal (distinct from spark engagement points).
// Only quality-signal actions move it. Used by the leaderboard + profile.
export const REPUTATION_POINTS = {
  ANSWER_UPVOTED: 10,
  ANSWER_ACCEPTED: 15,
  EXPERT_VERIFIED: 50,
}

export async function awardSpark({
  userId,
  action,
  referenceId,
  referenceType,
  points = SPARK_POINTS[action],
}) {
  if (typeof points !== 'number') {
    throw new Error(`Unknown spark action: ${action}`)
  }

  const transaction = await SparkTransaction.create({
    user_id: userId,
    action,
    points,
    reference_id: referenceId,
    reference_type: referenceType,
  })

  await User.updateOne({ user_id: userId }, { $inc: { spark_points: points } })

  // Bump reputation for trust-signal actions (kept in sync on the profile)
  const repGain = REPUTATION_POINTS[action]
  if (repGain) {
    await UserProfile.updateOne(
      { user_id: userId },
      { $inc: { reputation: repGain }, $setOnInsert: { user_id: userId } },
      { upsert: true },
    )
  }

  return transaction
}

export async function reserveBounty(userId, points, questionId) {
  if (points === 0) {
    return
  }

  const user = await User.findOneAndUpdate(
    { user_id: userId, spark_points: { $gte: points } },
    { $inc: { spark_points: -points } },
    { new: true },
  )

  if (!user) {
    throw createHttpError(403, 'Insufficient spark balance')
  }

  await SparkTransaction.create({
    user_id: userId,
    action: 'QUESTION_BOUNTY',
    points: -points,
    reference_id: questionId,
    reference_type: 'question',
  })
}
