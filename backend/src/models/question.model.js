import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

/**
 * questions
 *
 * Single collection serving both surfaces of the platform:
 *   - kind: "faq"        → curated, admin/resolver-authored, shown on FAQ pages
 *   - kind: "community"  → user-asked, shown on the Q&A feed
 *
 * Using one collection keeps search, moderation, voting, and notifications unified.
 * Promoting a community question to an FAQ is just a `kind` flip.
 */

const editHistorySchema = new mongoose.Schema(
  {
    edited_by: { type: String, required: true },       // user_id of editor
    edited_at: { type: Date, default: Date.now },
    previous_title: { type: String },
    previous_body: { type: String },
  },
  { _id: false },
)

const questionSchema = new mongoose.Schema(
  {
    question_id: {
      type: String,
      default: randomUUID,
      immutable: true,
      unique: true,
      index: true,
    },

    // Surface discriminator. Default: "community" keeps existing data valid.
    kind: {
      type: String,
      enum: ['faq', 'community'],
      default: 'community',
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 300,
    },

    // URL-friendly unique slug. Optional for community; required for FAQ.
    slug: {
      type: String,
      sparse: true,   // allows multiple nulls while enforcing uniqueness when set
      unique: true,
      lowercase: true,
      trim: true,
    },

    body: {
      type: String,
      required: true,
    },

    tags: [String],

    spark_bounty: {
      type: Number,
      default: 0,
      min: 0,
    },

    author_id: {
      type: String,
      required: true,
      index: true,
    },
    /* Added to track if the question was raised anonymously */
    is_anonymous: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: [
        // community statuses
        'unanswered', 'answered', 'closed', 'removed',
        // faq statuses
        'draft', 'published', 'archived',
      ],
      default: 'unanswered',
      index: true,
    },

    // Visibility is separate from status/moderation so soft-deletes and
    // admin-hidden content can be tracked independently.
    visibility: {
      type: String,
      enum: ['public', 'hidden', 'deleted'],
      default: 'public',
    },

    is_pinned: {
      type: Boolean,
      default: false,
    },

    // Prevent new answers/comments while keeping the question visible.
    is_locked: {
      type: Boolean,
      default: false,
    },

    // Cache field. Source of truth is the votes collection; only voting code
    // and the vote-counter rebuild script may mutate this value.
    upvotes: {
      type: Number,
      default: 0,
    },

    assigned_to: {
      type: String,
      default: null,
      index: true,
    },

    view_count: {
      type: Number,
      default: 0,
    },
    // Cache field. Source of truth is answers(question_id); only answer
    // lifecycle code and the question-counter rebuild script may mutate it.
    answer_count: {
      type: Number,
      default: 0,
    },
    // Cache field derived from visible resolver/admin/expert answers.
    // Maintained by answer lifecycle/moderation code and rebuild scripts.
    has_expert_answer: {
      type: Boolean,
      default: false,
    },

    // Updated on any new answer/comment. Drives the "active" sort order.
    last_activity_at: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // If a community question was promoted to FAQ, or this duplicates one,
    // store the linked FAQ's question_id here.
    linked_faq_id: {
      type: String,
      default: null,
    },

    moderation_status: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'approved',
      index: true,
    },
    moderated_by: String,
    moderated_at: Date,
    moderation_reason: String,
    removal_reason: String,

    // Tracks edits for audit trail.
    edit_history: {
      type: [editHistorySchema],
      default: [],
    },
  },
  {
    collection: 'questions',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
)

questionSchema.index({ tags: 1 })
questionSchema.index({ created_at: -1 })
questionSchema.index({ upvotes: -1 })
questionSchema.index({ kind: 1, status: 1, last_activity_at: -1 })

// Text search index.
questionSchema.index(
  { title: 'text', body: 'text', tags: 'text' },
  { weights: { title: 10, tags: 5, body: 1 }, name: 'question_text_idx' },
)

// Normalize body whitespace before saving.
questionSchema.pre('save', function () {
  if (this.isModified('body')) {
    this.body = this.body.replace(/[ \t]+/g, ' ').trim()
  }
})

export { questionSchema }
export default mongoose.model('Question', questionSchema)

