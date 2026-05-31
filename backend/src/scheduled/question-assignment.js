import cron from 'node-cron'
import { allocateUnansweredQuestions } from '../services/question-allocation.service.js'
import { appendFeatureLog } from '../utils/featureLogger.js'

const CRON_EXPR = '*/15 * * * *' // every 15 minutes

let isRunning = false

/**
 * Runs the allocation job. Prevents overlapping runs.
 */
async function runAllocation() {
  if (isRunning) {
    console.log('[QuestionAssignment] Job already running, skipping this cycle.')
    return
  }

  isRunning = true
  console.log('[QuestionAssignment] Starting allocation run…')

  try {
    const result = await allocateUnansweredQuestions()
    console.log(
      `[QuestionAssignment] Done — assigned: ${result.assigned}, escalated: ${result.escalated || 0}, skipped: ${result.skipped}, errors: ${result.errors}`,
    )
  } catch (err) {
    console.error('[QuestionAssignment] Unexpected error:', err.message)
    await appendFeatureLog({
      event: 'CRON_ERROR',
      error: err.message,
      timestamp: new Date().toISOString(),
    })
  } finally {
    isRunning = false
  }
}

/**
 * Starts the cron job. Call this after DB is connected in server.js.
 */
export function startQuestionAssignmentCron() {
  console.log(`[QuestionAssignment] Scheduling cron: ${CRON_EXPR}`)
  cron.schedule(CRON_EXPR, runAllocation, {
    timezone: 'Asia/Kolkata',
    scheduled: true,
  })
  console.log('[QuestionAssignment] Cron scheduled.')
}
