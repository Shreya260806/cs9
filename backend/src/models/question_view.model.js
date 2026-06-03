import mongoose from 'mongoose'

/**
 * question_views
 *
 * Records that a user has viewed a question at least once.
 * Unique compound index on (question_id, user_id) enforces one row per pair —
 * upserting a second time is a no-op, making the increment idempotent.
 */
const QuestionViewSchema = new mongoose.Schema(
  {
    question_id: { type: String, required: true, index: true },
    user_id:     { type: String, required: true, index: true },
    viewed_at:   { type: Date, default: Date.now },
  },
  { _id: false },
)

// One view record per user per question
QuestionViewSchema.index({ question_id: 1, user_id: 1 }, { unique: true })

export const QuestionView = mongoose.model('QuestionView', QuestionViewSchema)