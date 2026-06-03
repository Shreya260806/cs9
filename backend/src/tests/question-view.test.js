import assert from 'node:assert/strict'
import test from 'node:test'
import Question from '../models/question.model.js'
import { QuestionView } from '../models/question_view.model.js'
import { recordQuestionView } from '../controllers/question.controller.js'

// Behavioral test for the view-count dedup gate. No DB: the Mongoose model
// statics are mocked so we can assert exactly when view_count gets incremented.

function makeReq({ questionId = 'q1', userId = 'viewer' } = {}) {
  return { params: { questionId }, user: { userId } }
}

function makeRes() {
  return {
    body: null,
    json(payload) {
      this.body = payload
      return this
    },
  }
}

test('first view inserts a row and increments view_count', async (t) => {
  t.mock.method(Question, 'findOne', async () => ({ author_id: 'someone-else' }))
  // updateOne reports an insert happened
  t.mock.method(QuestionView, 'updateOne', async () => ({ upsertedCount: 1 }))
  const inc = t.mock.method(Question, 'updateOne', async () => ({ modifiedCount: 1 }))

  const res = makeRes()
  await recordQuestionView(makeReq(), res, (e) => { throw e })

  assert.equal(inc.mock.callCount(), 1, 'view_count $inc should fire once')
  assert.deepEqual(res.body, { success: true, viewed: true })
})

test('repeat view by same user does NOT increment view_count', async (t) => {
  t.mock.method(Question, 'findOne', async () => ({ author_id: 'someone-else' }))
  // updateOne matched the existing row — nothing inserted
  t.mock.method(QuestionView, 'updateOne', async () => ({ upsertedCount: 0 }))
  const inc = t.mock.method(Question, 'updateOne', async () => ({ modifiedCount: 1 }))

  const res = makeRes()
  await recordQuestionView(makeReq(), res, (e) => { throw e })

  assert.equal(inc.mock.callCount(), 0, 'view_count $inc must be skipped on a repeat view')
  assert.deepEqual(res.body, { success: true, viewed: false })
})

test('author viewing own question is not counted', async (t) => {
  t.mock.method(Question, 'findOne', async () => ({ author_id: 'viewer' }))
  const upsert = t.mock.method(QuestionView, 'updateOne', async () => ({ upsertedCount: 1 }))
  const inc = t.mock.method(Question, 'updateOne', async () => ({ modifiedCount: 1 }))

  const res = makeRes()
  await recordQuestionView(makeReq({ userId: 'viewer' }), res, (e) => { throw e })

  assert.equal(upsert.mock.callCount(), 0, 'no view row for the author')
  assert.equal(inc.mock.callCount(), 0, 'no increment for the author')
  assert.deepEqual(res.body, { success: true, viewed: false, reason: 'author' })
})

test('missing question yields a 404 via next(error)', async (t) => {
  t.mock.method(Question, 'findOne', async () => null)

  let captured
  const res = makeRes()
  await recordQuestionView(makeReq(), res, (e) => { captured = e })

  assert.equal(captured?.statusCode, 404)
})
