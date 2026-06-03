import { axisPrivate } from '../../api/axios'

export async function fetchAdminDashboard() {
  const { data } = await axisPrivate().get('/api/admin/dashboard')
  return data
}

// Post an admin response and resolve the question in one action. The reply shows
// as "ADMIN" in the thread regardless of which admin posted it.
export async function adminResolveQuery(questionId, body) {
  const { data } = await axisPrivate().post(`/api/admin/questions/${questionId}/resolve`, { body })
  return data
}

export async function fetchAdminNotifications() {
  const { data } = await axisPrivate().get('/api/notifications?limit=8')
  return data
}

export async function markAllAdminNotificationsRead() {
  const { data } = await axisPrivate().patch('/api/notifications/read-all')
  return data
}

export async function fetchAdminSettings() {
  const { data } = await axisPrivate().get('/api/admin/settings')
  return data.settings
}

export async function updateAdminSettingsSection(section, updates) {
  const { data } = await axisPrivate().patch(`/api/admin/settings/${section}`, updates)
  return data.settings
}

export async function previewLeaderboardWeights(weights, limit = 20) {
  const { data } = await axisPrivate().post('/api/admin/settings/leaderboard/preview', { weights, limit })
  return data
}

export async function logoutAdmin() {
  await axisPrivate().post('/api/auth/logout')
}

// ─── Flag moderation ─────────────────────────────────────────────────────────

export async function fetchFlags({ page = 1, limit = 10, status = '', targetType = '', reason = '' } = {}) {
  const params = new URLSearchParams({ page, limit })
  if (status) params.set('status', status)
  if (targetType) params.set('targetType', targetType)
  if (reason) params.set('reason', reason)
  const { data } = await axisPrivate().get(`/api/flags?${params}`)
  return { items: data.flags || [], pagination: data.pagination || { page, pages: 0, total: 0 } }
}

export async function fetchModerationQueue({ page = 1, limit = 10, targetType = '' } = {}) {
  const params = new URLSearchParams({ page, limit })
  if (targetType) params.set('targetType', targetType)
  const { data } = await axisPrivate().get(`/api/moderation/queue?${params}`)
  return { items: data.items || [], pagination: data.pagination || { page, pages: 0, total: 0 } }
}

export async function resolveFlag(flagId, { status, action, resolutionNote }) {
  const { data } = await axisPrivate().patch(`/api/flags/${flagId}/resolve`, { status, action, resolutionNote })
  return data
}

// ─── User management ─────────────────────────────────────────────────────────

export async function fetchUsers({ page = 1, limit = 10, search = '', role = '', status = '' } = {}) {
  const params = new URLSearchParams({ page, limit })
  if (search.trim()) params.set('search', search.trim())
  if (role) params.set('role', role)
  if (status) params.set('status', status)
  const { data } = await axisPrivate().get(`/api/users?${params}`)
  // users: [{ id, name, email, roles, avatarUrl, sparkPoints, status, createdAt }]
  return {
    users: data.users || [],
    pagination: data.pagination || { page, pages: 0, total: 0 },
  }
}

export async function assignUserRole(userId, role) {
  const { data } = await axisPrivate().post(`/api/admin/users/${userId}/roles`, { role })
  return data
}

export async function removeUserRole(userId, roleName) {
  const { data } = await axisPrivate().delete(`/api/admin/users/${userId}/roles/${roleName}`)
  return data
}

export async function updateUserStatus(userId, status, reason = '') {
  const { data } = await axisPrivate().patch(`/api/users/${userId}/status`, { status, reason })
  return data
}

export async function createUser({ name, email, password, role = 'USER' }) {
  const { data } = await axisPrivate().post('/api/admin/users', { name, email, password, role })
  return data.user
}

export async function fetchTags() {
  const { data } = await axisPrivate().get('/api/admin/tags')
  return data.tags
}

export async function createTag({ name, description }) {
  const { data } = await axisPrivate().post('/api/admin/tags', { name, description })
  return data.tag
}

export async function renameTag(tagName, newName) {
  const { data } = await axisPrivate().patch(`/api/admin/tags/${encodeURIComponent(tagName)}`, { name: newName })
  return data.tag
}

export async function deleteTag(tagName) {
  const { data } = await axisPrivate().delete(`/api/admin/tags/${encodeURIComponent(tagName)}`)
  return data
}

// ─── Queries management ──────────────────────────────────────────────────────

export async function fetchAdminQuestions({ page = 1, limit = 10, search = '', status = '', kind = '', id = '', hasExpertAnswer = '' } = {}) {
  const params = new URLSearchParams({ page, limit, sort: 'latest' })
  if (search.trim()) params.set('search', search.trim())
  if (status) params.set('status', status)
  if (kind) params.set('kind', kind)
  if (id.trim()) params.set('id', id.trim())
  if (hasExpertAnswer !== '') params.set('hasExpertAnswer', hasExpertAnswer)
  // Admins receive every question (all kinds/statuses) — see listQuestions.
  const { data } = await axisPrivate().get(`/api/questions?${params}`)
  return {
    questions: data.questions || [],
    pagination: data.pagination || { page, pages: 0, total: 0 },
  }
}

// ─── FAQ management ──────────────────────────────────────────────────────────

export async function fetchFAQs({ limit = 1000 } = {}) {
  const { data } = await axisPrivate().get(`/api/questions?kind=faq&limit=${limit}`)
  // Admins receive removed entries too; hide soft-deleted FAQs from the panel.
  return (data.questions || []).filter((faq) => faq.status !== 'removed')
}

export async function updateFAQ(questionId, updates) {
  const { data } = await axisPrivate().patch(`/api/questions/${questionId}`, updates)
  return data.question
}

export async function deleteFAQ(questionId, reason = '') {
  const { data } = await axisPrivate().delete(`/api/questions/${questionId}`, {
    data: { reason },
  })
  return data
}

export async function createFAQ({ title, body, tags }) {
  const { data } = await axisPrivate().post('/api/questions', {
    kind: 'faq',
    title,
    body,
    tags,
  })
  return data.question
}
