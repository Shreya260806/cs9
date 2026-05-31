import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    notification_id: {
      type: String,
      default: randomUUID,
      immutable: true,
      unique: true,
      index: true,
    },
    recipient_id: {
      type: String,
      required: true,
      index: true,
    },
    actor_id: String,
    type: {
      type: String,
      enum: [
        'answer',
        'upvote',
        'badge',
        'mention',
        'accepted',
        'flag_resolved',
        'content_hidden',
        'comment',
        'reply',
        'warning',
        'account_status',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    reference_id: String,
    reference_type: {
      type: String,
      enum: ['question', 'answer', 'comment', 'user'],
    },
    link: {
      type: String,
    },
    thread_anchor: {
      answer_id: String,
      root_comment_id: String,
    },
    is_read: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: 'notifications',
    timestamps: { createdAt: 'created_at', updatedAt: false },
  },
)

notificationSchema.index({ recipient_id: 1, is_read: 1 })
notificationSchema.index({ recipient_id: 1, created_at: -1 })

export default mongoose.model('Notification', notificationSchema)
