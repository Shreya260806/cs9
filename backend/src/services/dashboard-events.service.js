import { subscribeDomainEvent } from './domain-events.service.js'

const dashboardTopics = new Map()

function writeEvent(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function topicForClient(req) {
  if (req.query.my === '1') {
    return `questions:my:${req.user.userId}`
  }

  return 'questions:all'
}

function addClientToTopic(topic, client) {
  if (!dashboardTopics.has(topic)) {
    dashboardTopics.set(topic, new Set())
  }

  dashboardTopics.get(topic).add(client)
}

function removeClientFromTopic(topic, client) {
  const clients = dashboardTopics.get(topic)
  if (!clients) return

  clients.delete(client)
  if (clients.size === 0) {
    dashboardTopics.delete(topic)
  }
}

function safeWriteEvent(topic, client, event, data) {
  try {
    writeEvent(client.res, event, data)
  } catch {
    removeClientFromTopic(topic, client)
    try {
      client.res.end()
    } catch {
      // The connection is already unusable; dropping it from the topic is enough.
    }
  }
}

export function registerDashboardEvents(req, res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const topic = topicForClient(req)
  const client = { res }
  addClientToTopic(topic, client)

  safeWriteEvent(topic, client, 'connected', { success: true, timestamp: new Date().toISOString() })

  const heartbeat = setInterval(() => {
    safeWriteEvent(topic, client, 'heartbeat', { timestamp: new Date().toISOString() })
  }, 30_000)

  req.on('close', () => {
    clearInterval(heartbeat)
    removeClientFromTopic(topic, client)
  })
}

function sendToTopic(topic, event, data = {}) {
  const clients = dashboardTopics.get(topic)
  if (!clients) return

  const payload = {
    ...data,
    timestamp: new Date().toISOString(),
  }

  for (const client of clients) {
    safeWriteEvent(topic, client, event, payload)
  }
}

subscribeDomainEvent('question.vote.changed', (event) => {
  sendToTopic('questions:all', 'question-vote', event)
  sendToTopic(`questions:my:${event.authorId}`, 'question-vote', event)
})
