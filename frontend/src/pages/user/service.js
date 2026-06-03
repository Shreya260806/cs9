import { axisPrivate } from '../../api/axios'

// ─── Helpers ────────────────────────────────────────────────────────────────

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function mapStatus(q) {
  if (q.status === 'unanswered') return 'Active'
  if (q.status === 'answered') return 'In Progress'
  if (q.status === 'closed') return 'Resolved'
  return 'Active'
}

export function normalizeQuestion(q, currentUserId) {
  const tags = (q.tags || []).slice(0, 2).map(tag => ({
    label: tag.charAt(0).toUpperCase() + tag.slice(1),
    type: 'dark',
  }))

  const meta = timeAgo(q.created_at)

  const isSelf = q.author_id === currentUserId

  return {
    id: q.question_id,
    upvotes: q.upvotes ?? 0,
    hasUpvoted: q.hasVoted === true,
    author: isSelf ? 'self' : 'other',
    authorName: isSelf ? 'You' : (q.author_name || 'User'),
    timestamp: new Date(q.created_at).getTime(),
    tags,
    meta,
    title: q.title,
    desc: q.body,
    comments: q.answer_count ?? 0,
    status: mapStatus(q),
  }
}

// ─── Questions ───────────────────────────────────────────────────────────────

export async function fetchQuestions({
  search = '',
  tag = '',
  sort = 'latest',
  status = '',
  createdAfter = '',
  my = false,
  page = 1,
  limit = 30,
  questionId = '',
} = {}) {
  const params = new URLSearchParams({ kind: 'community', page, limit })
  if (search) params.set('search', search)
  if (tag) params.set('tag', tag)
  if (sort) params.set('sort', sort)
  if (status) params.set('status', status)
  if (createdAfter) params.set('createdAfter', createdAfter)
  if (my) params.set('my', '1')
  if (questionId) params.set('id', questionId)

  const { data } = await axisPrivate().get(`/api/questions?${params}`)
  return data
}

export async function fetchQuestionCounts({
  search = '',
  tag = '',
  my = false,
} = {}) {
  const params = new URLSearchParams({ kind: 'community' })
  if (search) params.set('search', search)
  if (tag) params.set('tag', tag)
  if (my) params.set('my', '1')

  const { data } = await axisPrivate().get(`/api/questions/counts?${params}`)
  return data
}


export async function voteQuestion(questionId) {
  const { data } = await axisPrivate().post(`/api/questions/${questionId}/vote`)
  return data
}

export async function fetchQuestionTags() {
  const { data } = await axisPrivate().get('/api/questions/tags')
  return data.tags || []
}

export async function createQuestion({ title, body, tags = [], isAnonymous = false }) {
  const { data } = await axisPrivate().post('/api/questions', { title, body, tags, isAnonymous })
  return data // { success, questionId }
}

// ─── Question detail / thread ─────────────────────────────────────────────────

export async function fetchQuestionDetail(questionId) {
  const { data } = await axisPrivate().get(`/api/questions/${questionId}`)
  return data // { question, answers, comments }
}

export async function recordQuestionView(questionId) {
  // Fire-and-forget — view tracking must never block or break the page load.
  axisPrivate().post(`/api/questions/${questionId}/view`).catch(() => {})
}

export async function postAnswer(questionId, body) {
  const { data } = await axisPrivate().post(`/api/questions/${questionId}/answers`, { body })
  return data
}

export async function voteAnswer(answerId, vote) {
  const { data } = await axisPrivate().post(`/api/answers/${answerId}/vote`, { vote })
  return data
}

export async function resolveQuestion(questionId, resolved = true) {
  const { data } = await axisPrivate().patch(`/api/questions/${questionId}/resolve`, { resolved })
  return data
}

export async function acceptAnswer(questionId, answerId) {
  const { data } = await axisPrivate().post(`/api/questions/${questionId}/accept-answer/${answerId}`)
  return data
}

export async function postComment(answerId, body, parentId = null) {
  const { data } = await axisPrivate().post('/api/comments', {
    targetType: 'answer',
    targetId: answerId,
    body,
    parentId,
  })
  return data
}

export async function reportContent({ targetType, targetId, reason, description }) {
  const { data } = await axisPrivate().post('/api/flags', {
    targetType, targetId, reason, description,
  })
  return data
}

// ─── Leaderboard ───────────────────────────────────────────────────────────────

export async function fetchLeaderboard({ type = 'spark', limit = 20, window } = {}) {
  const params = new URLSearchParams({ type, limit })
  if (window) params.set('window', window) // 'today' | 'monthly' (spark only)
  const { data } = await axisPrivate().get(`/api/leaderboard?${params}`)
  // [{ userId, displayName, score, answersCount?, upvotesReceived? }]
  return data.leaderboard || []
}

// ─── Notifications ───────────────────────────────────────────────────────────

export async function fetchNotifications() {
  const { data } = await axisPrivate().get('/api/notifications?limit=10')
  return data
}

export async function markNotifRead(notificationId) {
  const { data } = await axisPrivate().patch(`/api/notifications/${notificationId}/read`)
  return data
}

export async function markAllNotifRead() {
  const { data } = await axisPrivate().patch('/api/notifications/read-all')
  return data
}

export async function fetchUserContributions(userId, limit = 10) {
  const { data } = await axisPrivate().get(`/api/users/${userId}/contributions?limit=${limit}`)
  return data
}

export async function fetchMyContributions() {
  const { data } = await axisPrivate().get('/api/users/me/contributions?limit=100')
  return data
}

export async function logoutUser() {
  await axisPrivate().post('/api/auth/logout')
}

// ─── Profile ───────────────────────────────────────────────────────────────

export async function fetchProfile() {
  const { data } = await axisPrivate().get('/api/profile/me')
  return data.profile
}

export async function updateProfile(updates) {
  const { data } = await axisPrivate().patch('/api/profile/me', updates)
  return data.profile
}

export async function changePassword(currentPassword, newPassword) {
  const { data } = await axisPrivate().patch('/api/profile/password', {
    currentPassword,
    newPassword,
  })
  return data
}
