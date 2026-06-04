import Answer from '../models/answer.model.js'
import Comment from '../models/comment.model.js'
import Question from '../models/question.model.js'
import { createHttpError } from '../utils/http.js'

const targets = {
  question: { Model: Question, idField: 'question_id' },
  answer: { Model: Answer, idField: 'answer_id' },
  comment: { Model: Comment, idField: 'comment_id' },
}

export function getTargetDefinition(targetType) {
  return targets[targetType] || null
}

export async function findContentTarget(targetType, targetId) {
  const definition = getTargetDefinition(targetType)

  if (!definition) {
    throw createHttpError(400, 'Target type must be question, answer, or comment')
  }

  return definition.Model.findOne({ [definition.idField]: targetId })
}

export async function markContentPending(targetType, targetId) {
  const definition = getTargetDefinition(targetType)

  if (!definition) {
    throw createHttpError(400, 'Target type must be question, answer, or comment')
  }

  return definition.Model.findOneAndUpdate(
    { [definition.idField]: targetId },
    { $set: { moderation_status: 'pending' } },
    { new: true, runValidators: true },
  )
}

export async function applyModerationAction({
  targetType,
  targetId,
  action,
  adminId,
  reason,
}) {
  const definition = getTargetDefinition(targetType)
  const allowedActions = ['approve', 'hide', 'restore', 'delete', 'lock', 'unlock']

  if (!definition) {
    throw createHttpError(400, 'Target type must be question, answer, or comment')
  }

  if (!allowedActions.includes(action)) {
    throw createHttpError(400, 'Invalid moderation action')
  }

  if ((action === 'lock' || action === 'unlock') && targetType !== 'question') {
    throw createHttpError(400, 'Only questions can be locked or unlocked')
  }

  const updates = {
    moderated_by: adminId,
    moderated_at: new Date(),
    moderation_reason: reason || '',
  }

  if (action === 'approve' || action === 'restore') {
    updates.moderation_status = 'approved'
    if (targetType === 'comment') {
      updates.is_deleted = false
    }
    if (targetType === 'answer') {
      updates.is_deleted = false
    }
    if (action === 'restore' && targetType === 'question') {
      const question = await Question.findOne({ question_id: targetId }).select('answer_count')
      updates.status = question?.answer_count > 0 ? 'answered' : 'unanswered'
    }
  }

  if (action === 'hide' || action === 'delete') {
    updates.moderation_status = 'rejected'
    if (targetType === 'question') {
      updates.status = 'removed'
    }
    if (targetType === 'comment') {
      updates.is_deleted = true
    }
    if (targetType === 'answer') {
      updates.is_deleted = true
      const answer = await Answer.findOne({ answer_id: targetId }).select('question_id is_expert')
      if (answer) {
        await Question.updateOne(
          { question_id: answer.question_id },
          { $inc: { answer_count: -1 } },
        )
        if (answer.is_expert) {
          const hasOtherExpertAnswer = await Answer.exists({
            question_id: answer.question_id,
            is_deleted: { $ne: true },
            is_expert: true,
            answer_id: { $ne: targetId },
          })
          await Question.updateOne(
            { question_id: answer.question_id },
            { $set: { has_expert_answer: !!hasOtherExpertAnswer } },
          )
        }
      }
    }
  }

  if (action === 'restore') {
    if (targetType === 'answer') {
      const answer = await Answer.findOne({ answer_id: targetId }).select('question_id is_expert')
      if (answer) {
        await Question.updateOne(
          { question_id: answer.question_id },
          { $inc: { answer_count: 1 } },
        )
        if (answer.is_expert) {
          await Question.updateOne(
            { question_id: answer.question_id },
            { $set: { has_expert_answer: true } },
          )
        }
      }
    }
  }

  if (action === 'lock') {
    updates.status = 'closed'
    updates.is_locked = true
  }

  if (action === 'unlock') {
    const question = await Question.findOne({ question_id: targetId }).select('answer_count')
    updates.status = question?.answer_count > 0 ? 'answered' : 'unanswered'
    updates.is_locked = false
  }

  const target = await definition.Model.findOneAndUpdate(
    { [definition.idField]: targetId },
    { $set: updates },
    { new: true, runValidators: true },
  )

  if (!target) {
    throw createHttpError(404, 'Target not found')
  }

  return target
}
