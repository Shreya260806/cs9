import Answer from '../models/answer.model.js'
import Notification from '../models/notification.model.js'
import Question from '../models/question.model.js'
import Vote from '../models/vote.model.js'
import { awardSpark } from '../services/spark.service.js'
import { createHttpError } from '../utils/http.js'

function isAdmin(req) {
  return req.user.roles.includes('ADMIN')
}

function canManage(req, answer) {
  return isAdmin(req) || answer.author_id === req.user.userId
}

export async function createAnswer(req, res, next) {
  try {
    const question = await Question.findOne({ question_id: req.params.questionId })

    if (!question) {
      throw createHttpError(404, 'Question not found')
    }
    if (['closed', 'removed'].includes(question.status)) {
      throw createHttpError(409, 'Question closed')
    }
    if (question.is_locked) {
      throw createHttpError(423, 'Question is locked')
    }

    if (!req.body.body || req.body.body.trim().length < 15) {
      throw createHttpError(400, 'Answer must be at least 15 characters')
    }

    const answer = await Answer.create({
      question_id: question.question_id,
      author_id: req.user.userId,
      body: req.body.body,
      references: req.body.references,
      attachments: req.body.attachments,
      is_expert: req.user.roles.includes('RESOLVER') || isAdmin(req),
    })

    await Question.updateOne(
      { question_id: question.question_id },
      {
        $inc: { answer_count: 1 },
        $set: {
          status: 'answered',
          last_activity_at: new Date(),
          ...(answer.is_expert && { has_expert_answer: true }),
        },
      },
    )

    await awardSpark({
      userId: req.user.userId,
      action: 'SUBMIT_ANSWER',
      referenceId: answer.answer_id,
      referenceType: 'answer',
    })

    if (Array.isArray(answer.references) && answer.references.length) {
      await awardSpark({
        userId: req.user.userId,
        action: 'ADD_REFERENCE',
        referenceId: answer.answer_id,
        referenceType: 'answer',
      })
    }

    if (question.author_id !== req.user.userId) {
      await Notification.create({
        recipient_id: question.author_id,
        actor_id: req.user.userId,
        type: 'answer',
        title: 'New answer',
        body: 'Your question received a new answer.',
        reference_id: question.question_id,
        reference_type: 'question',
        link: `/query/${question.question_id}`,
      })
    }

    res.status(201).json({
      success: true,
      answerId: answer.answer_id,
      message: 'Answer created',
    })
  } catch (error) {
    next(error)
  }
}

export async function updateAnswer(req, res, next) {
  try {
    const answer = await Answer.findOne({ answer_id: req.params.answerId })

    if (!answer) {
      throw createHttpError(404, 'Answer not found')
    }
    if (!canManage(req, answer)) {
      throw createHttpError(403, 'Forbidden')
    }
    if (answer.is_accepted && !isAdmin(req)) {
      throw createHttpError(409, 'Answer locked')
    }
    if (typeof req.body.body !== 'string') {
      throw createHttpError(400, 'Answer body is required')
    }

    // Record the previous version in edit history before overwriting
    answer.edit_history.push({
      edited_by: req.user.userId,
      edited_at: new Date(),
      previous_body: answer.body,
    })

    answer.body = req.body.body
    await answer.save()

    res.json({ success: true, answer })
  } catch (error) {
    next(error)
  }
}

export async function deleteAnswer(req, res, next) {
  try {
    const answer = await Answer.findOne({ answer_id: req.params.answerId })

    if (!answer) {
      throw createHttpError(404, 'Answer not found')
    }
    if (!canManage(req, answer)) {
      throw createHttpError(403, 'Forbidden')
    }
    if (answer.is_accepted && !isAdmin(req)) {
      throw createHttpError(409, 'Accepted answer cannot be deleted by user')
    }

    answer.is_deleted = true
    answer.moderation_status = 'rejected'
    answer.removal_reason = req.body.reason || ''
    await answer.save()

    // Sync parent question counters
    await Question.updateOne(
      { question_id: answer.question_id },
      { $inc: { answer_count: -1 } },
    )

    // If this was an expert answer, re-evaluate has_expert_answer
    if (answer.is_expert) {
      const hasOtherExpertAnswer = await Answer.exists({
        question_id: answer.question_id,
        is_deleted: { $ne: true },
        is_expert: true,
        answer_id: { $ne: answer.answer_id },
      })
      await Question.updateOne(
        { question_id: answer.question_id },
        { $set: { has_expert_answer: !!hasOtherExpertAnswer } },
      )
    }

    res.json({ success: true, message: 'Answer deleted' })
  } catch (error) {
    next(error)
  }
}

export async function voteAnswer(req, res, next) {
  try {
    const voteValue = req.body.vote === 'up' ? 1 : req.body.vote === 'down' ? -1 : null

    if (voteValue === null) {
      throw createHttpError(400, 'Vote must be "up" or "down"')
    }

    const answer = await Answer.findOne({ answer_id: req.params.answerId })
    if (!answer || answer.is_deleted === true) {
      throw createHttpError(404, 'Answer not found')
    }
    if (answer.author_id === req.user.userId) {
      throw createHttpError(403, 'Cannot vote own answer')
    }

    // Check for an existing vote from this user on this answer
    const existingVote = await Vote.findOne({
      user_id: req.user.userId,
      target_type: 'answer',
      target_id: answer.answer_id,
    })

    let myVote = voteValue

    if (existingVote) {
      if (existingVote.value === voteValue) {
        // Same arrow clicked again → deselect (remove the vote)
        await existingVote.deleteOne()
        await Answer.updateOne(
          { answer_id: answer.answer_id },
          {
            $inc: {
              upvotes: voteValue === 1 ? -1 : 0,
              downvotes: voteValue === -1 ? -1 : 0,
              score: -voteValue,
            },
          },
        )
        myVote = 0
      } else {
        // Flip the vote: reverse the old counter and apply the new one
        const upvotesDelta = voteValue === 1 ? 1 : -1
        const downvotesDelta = voteValue === -1 ? 1 : -1
        const scoreDelta = voteValue === 1 ? 2 : -2 // flip from -1→+1 or +1→-1

        existingVote.value = voteValue
        await existingVote.save()

        await Answer.updateOne(
          { answer_id: answer.answer_id },
          {
            $inc: {
              upvotes: upvotesDelta,
              downvotes: downvotesDelta,
              score: scoreDelta,
            },
          },
        )
      }
    } else {
      // New vote
      await Vote.create({
        user_id: req.user.userId,
        target_type: 'answer',
        target_id: answer.answer_id,
        value: voteValue,
      })

      const upvotesDelta = voteValue === 1 ? 1 : 0
      const downvotesDelta = voteValue === -1 ? 1 : 0

      await Answer.updateOne(
        { answer_id: answer.answer_id },
        {
          $inc: {
            upvotes: upvotesDelta,
            downvotes: downvotesDelta,
            score: voteValue,
          },
        },
      )

      if (voteValue === 1) {
        await awardSpark({
          userId: answer.author_id,
          action: 'ANSWER_UPVOTED',
          referenceId: answer.answer_id,
          referenceType: 'answer',
        })
      }
    }

    // Re-fetch the updated answer for accurate score in the response
    const updated = await Answer.findOne({ answer_id: answer.answer_id }).lean()

    res.json({
      success: true,
      score: updated.score,
      upvotes: updated.upvotes,
      downvotes: updated.downvotes,
      myVote,
    })
  } catch (error) {
    next(error)
  }
}
