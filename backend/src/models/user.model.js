import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      default: randomUUID,
      immutable: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    status: {
      type: String,
      enum: ['active', 'disabled', 'suspended'],
      default: 'active',
      index: true,
    },
    status_reason: {
      type: String,
      trim: true,
    },
    status_updated_by: String,
    status_updated_at: Date,
    // Cache field. Source of truth is spark_transactions; only spark.service.js
    // and the spark reconciliation script may mutate this balance.
    spark_points: {
      type: Number,
      default: 0,
      index: true,
    },
    last_login_at: Date,
  },
  {
    collection: 'users',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    toJSON: {
      transform: (_document, returnedObject) => {
        delete returnedObject._id
        delete returnedObject.passwordHash
        delete returnedObject.__v
        return returnedObject
      },
    },
  },
)

export default mongoose.model('User', userSchema)
