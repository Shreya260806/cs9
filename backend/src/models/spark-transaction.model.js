import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

const sparkTransactionSchema = new mongoose.Schema(
  {
    transaction_id: {
      type: String,
      default: randomUUID,
      immutable: true,
      unique: true,
      index: true,
    },
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    // Signed ledger entry. Source of truth for spark balances.
    points: {
      type: Number,
      required: true,
    },
    reference_id: String,
    reference_type: {
      type: String,
      enum: ['question', 'answer'],
    },
  },
  {
    collection: 'spark_transactions',
    timestamps: { createdAt: 'created_at', updatedAt: false },
  },
)

sparkTransactionSchema.index({ user_id: 1, created_at: -1 })
sparkTransactionSchema.index({ reference_type: 1, reference_id: 1 })
sparkTransactionSchema.index({ action: 1, created_at: -1 })

export default mongoose.model('SparkTransaction', sparkTransactionSchema)
