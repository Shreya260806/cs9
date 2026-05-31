import { axisPrivate } from '../../api/axios'

export async function fetchAdminDashboard() {
  const { data } = await axisPrivate().get('/api/admin/dashboard')
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

export async function logoutAdmin() {
  await axisPrivate().post('/api/auth/logout')
}

// ─── FAQ management ──────────────────────────────────────────────────────────

export async function fetchFAQs({ limit = 100 } = {}) {
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
