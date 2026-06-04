import assert from 'node:assert/strict'
import test from 'node:test'
import Question from '../models/question.model.js'
import { applyModerationAction } from '../services/content.service.js'

test('applyModerationAction with action hide sets moderation_status to rejected and status to removed for question', async (t) => {
  const findOneAndUpdateMock = t.mock.method(Question, 'findOneAndUpdate', async (query, update) => {
    return {
      question_id: 'q-123',
      ...update.$set,
    }
  })

  const result = await applyModerationAction({
    targetType: 'question',
    targetId: 'q-123',
    action: 'hide',
    adminId: 'admin-123',
    reason: 'inappropriate',
  })

  assert.equal(result.moderation_status, 'rejected')
  assert.equal(result.status, 'removed')
  assert.equal(result.moderated_by, 'admin-123')
  assert.equal(result.moderation_reason, 'inappropriate')
  assert.equal(findOneAndUpdateMock.mock.callCount(), 1)
})
