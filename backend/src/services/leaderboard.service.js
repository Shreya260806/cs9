import Answer from '../models/answer.model.js'
import Comment from '../models/comment.model.js'
import Notification from '../models/notification.model.js'
import Question from '../models/question.model.js'
import UserProfile from '../models/user-profile.model.js'
import User from '../models/user.model.js'

function keyed(rows, mapValue) {
  return Object.fromEntries(rows.map((row) => [row._id, mapValue(row)]))
}

/**
 * Raw contributor stats for a set of user IDs.
 * Returns a map of userId → { questionsAsked, questionUpvotes, answersGiven,
 * acceptedResolutions, answerUpvotes, resolverActivity, commentsGiven, commentUpvotes,
 * upvotesReceived, sparkPoints, reputation, negativeActions }
 *
 * @param {string[]} userIds
 * @param {Function|null} getNameByUserId - when provided (admin path), used instead of
 *        UserProfile.display_name so admins always see real User.name values
 */
export async function getContributorStats(userIds, getNameByUserId = null) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return {}

  // Batch-fetch real names once when in admin mode (avoids N DB round-trips)
  const nameById = getNameByUserId ? await getNameByUserId(ids) : {}

  const [
    profiles,
    questionRows,
    answerRows,
    commentRows,
    warningRows,
  ] = await Promise.all([
    UserProfile.find({ user_id: { $in: ids } }).select('user_id display_name reputation').lean(),
    Question.aggregate([
      {
        $match: {
          author_id: { $in: ids },
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
          author_id: { $in: ids },
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
          author_id: { $in: ids },
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
          recipient_id: { $in: ids },
          type: { $in: ['warning', 'content_hidden'] },
        },
      },
      { $group: { _id: '$recipient_id', negativeActions: { $sum: 1 } } },
    ]),
  ])

  const profileById = Object.fromEntries(profiles.map((p) => [p.user_id, p]))
  const questionsById = keyed(questionRows, (r) => r)
  const answersById = keyed(answerRows, (r) => r)
  const commentsById = keyed(commentRows, (r) => r)
  const warningsById = keyed(warningRows, (r) => r.negativeActions)

  return Object.fromEntries(
    ids.map((userId) => {
      const profile = profileById[userId] || {}
      const questions = questionsById[userId] || {}
      const answers = answersById[userId] || {}
      const comments = commentsById[userId] || {}

      const upvotesReceived =
        (questions.questionUpvotes || 0) +
        (answers.answerUpvotes || 0) +
        (comments.commentUpvotes || 0)

      const displayName = getNameByUserId
        ? (nameById[userId] || null)
        : (profile.display_name || null)

      return [
        userId,
        {
          displayName,
          questionsAsked: questions.questionsAsked || 0,
          questionUpvotes: questions.questionUpvotes || 0,
          answersGiven: answers.answersGiven || 0,
          acceptedResolutions: answers.acceptedResolutions || 0,
          answerUpvotes: answers.answerUpvotes || 0,
          resolverActivity: answers.resolverActivity || 0,
          commentsGiven: comments.commentsGiven || 0,
          commentUpvotes: comments.commentUpvotes || 0,
          upvotesReceived,
          sparkPoints: 0, // filled by caller from User doc
          reputation: profile.reputation || 0,
          negativeActions: warningsById[userId] || 0,
        },
      ]
    }),
  )
}

/**
 * Score one user's stats with given weights.
 *
 * Formula:
 *   score = questionsAsked   × W.questionsAskedWeight
 *         + answersGiven     × W.answersGivenWeight
 *         + commentsGiven    × W.commentsGivenWeight
 *         + acceptedRes      × W.acceptedResolutionsWeight
 *         + upvotesReceived  × W.upvotesReceivedWeight
 *         + resolverActivity × W.resolverActivityWeight
 *         + sparkPoints      × W.sparkPointsWeight
 *         + reputation       × W.reputationWeight
 *         - negativeActions  × W.warningPenaltyWeight
 */
export function computeScore(stats, weights) {
  const {
    questionsAsked = 0,
    answersGiven = 0,
    commentsGiven = 0,
    acceptedResolutions = 0,
    upvotesReceived = 0,
    resolverActivity = 0,
    sparkPoints = 0,
    reputation = 0,
    negativeActions = 0,
  } = stats

  return (
    questionsAsked * (weights.questionsAskedWeight || 0) +
    answersGiven * (weights.answersGivenWeight || 0) +
    commentsGiven * (weights.commentsGivenWeight || 0) +
    acceptedResolutions * (weights.acceptedResolutionsWeight || 0) +
    upvotesReceived * (weights.upvotesReceivedWeight || 0) +
    resolverActivity * (weights.resolverActivityWeight || 0) +
    sparkPoints * (weights.sparkPointsWeight || 0) +
    reputation * (weights.reputationWeight || 0) -
    negativeActions * (weights.warningPenaltyWeight || 0)
  )
}

/**
 * Ranked leaderboard entries for a list of { user, stats } objects.
 * Returns sorted array with rank, score, and component breakdown.
 */
export function buildLeaderboardRows(usersWithStats, weights) {
  return usersWithStats
    .map(({ user, stats }) => {
      const score = computeScore(stats, weights)
      return {
        userId: user.user_id,
        displayName: stats.displayName || user.name || 'Unknown',
        score: Math.round(score * 100) / 100,
        // component breakdown for the preview UI
        questionsAsked: stats.questionsAsked,
        answersCount: stats.answersGiven,
        commentsCount: stats.commentsGiven,
        acceptedResolutions: stats.acceptedResolutions,
        upvotesReceived: stats.upvotesReceived,
        sparkPoints: stats.sparkPoints,
        reputation: stats.reputation,
        negativeActions: stats.negativeActions,
      }
    })
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
}
