import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

const userProfileSchema = new mongoose.Schema(
  {
    profile_id: {
      type: String,
      default: randomUUID,
      immutable: true,
      unique: true,
      index: true,
    },
    user_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    display_name: String,
    bio: String,
    avatar_url: String,
    location: String,
    social_links: {
      type: Map,
      of: String,
    },
    reputation: {
      type: Number,
      default: 0,
    },
    phone: String,
    credentials_url: String,
    expertise: [String],
    categories: [String],
    tags: [String],
    onboarding_completed: {
      type: Boolean,
      default: false,
    },
    onboarding_step: Number,
  },
  {
    collection: 'user_profiles',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
)

userProfileSchema.index({ display_name: 1 })
userProfileSchema.index({ expertise: 1 })
userProfileSchema.index({ categories: 1 })
userProfileSchema.index({ tags: 1 })

export default mongoose.model('UserProfile', userProfileSchema)
