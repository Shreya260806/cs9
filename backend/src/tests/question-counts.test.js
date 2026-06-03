import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildQuestionBaseFilter,
  getQuestionStatusFilter,
} from '../controllers/question.controller.js'

// req helper — no `search` key, so buildQuestionBaseFilter never touches the DB.
function makeReq({ query = {}, roles = ['USER'], userId = 'u1' } = {}) {
  return { query, user: { userId, roles } }
}

test('non-admin base filter applies the moderation gate', async () => {
  const filter = await buildQuestionBaseFilter(makeReq())
  assert.deepEqual(filter, { kind: 'community', moderation_status: 'approved' })
})

test('admin base filter omits the moderation gate', async () => {
  const filter = await buildQuestionBaseFilter(makeReq({ roles: ['ADMIN'] }))
  assert.deepEqual(filter, { kind: 'community' })
})

test('kind is passed through to the filter', async () => {
  const filter = await buildQuestionBaseFilter(makeReq({ query: { kind: 'community' } }))
  assert.equal(filter.kind, 'community')
})

test('a single tag matches exactly; multiple tags match any', async () => {
  const one = await buildQuestionBaseFilter(makeReq({ query: { tag: 'general' } }))
  assert.equal(one.tags, 'general')

  const many = await buildQuestionBaseFilter(makeReq({ query: { tag: 'general, vins' } }))
  assert.deepEqual(many.tags, { $in: ['general', 'vins'] })
})

test('my=1 scopes the filter to the requesting user', async () => {
  const filter = await buildQuestionBaseFilter(makeReq({ query: { my: '1' }, userId: 'abc' }))
  assert.equal(filter.author_id, 'abc')
})

// Guards the dashboard count contract: the Unanswered/Resolved tab counts in
// getQuestionCounts are derived through getQuestionStatusFilter, so they must
// resolve to the same status values the list endpoint filters on.
test('dashboard Unanswered count maps to status "unanswered"', () => {
  assert.equal(getQuestionStatusFilter('unanswered'), 'unanswered')
})

test('dashboard Resolved count maps to status "closed"', () => {
  assert.equal(getQuestionStatusFilter('resolved'), 'closed')
})
