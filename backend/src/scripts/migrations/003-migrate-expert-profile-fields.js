import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../../config/db.js'
import User from '../../models/user.model.js'
import UserProfile from '../../models/user-profile.model.js'

const apply = process.argv.includes('--apply')
const dryRun = !apply

const legacyExpertFields = {
  is_expert: '',
  is_verified_expert: '',
  expert_type: '',
  specialty: '',
}

const legacyProfileObjects = {
  kyc: '',
  course: '',
  files: '',
}

const stats = {
  mode: dryRun ? 'dry-run' : 'apply',
  expertUsersScanned: 0,
  wouldAddExpertise: 0,
  addedExpertise: 0,
  wouldAddTag: 0,
  addedTag: 0,
  wouldUnsetExpertUsers: 0,
  unsetExpertUsers: 0,
  broadProfilesScanned: 0,
  wouldCopyProfilePhoto: 0,
  copiedProfilePhoto: 0,
  wouldCopySupportingDoc: 0,
  copiedSupportingDoc: 0,
  wouldUnsetBroadProfileObjects: 0,
  unsetBroadProfileObjects: 0,
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function arrayHasValue(values, nextValue) {
  return Array.isArray(values) && values.includes(nextValue)
}

try {
  await connectDB()

  const expertCursor = User.collection.find(
    {
      $or: [
        { is_expert: { $exists: true } },
        { is_verified_expert: { $exists: true } },
        { expert_type: { $exists: true } },
        { specialty: { $exists: true } },
      ],
    },
    { projection: { user_id: 1, expert_type: 1, specialty: 1 } },
  )

  for await (const user of expertCursor) {
    stats.expertUsersScanned += 1

    const profile = await UserProfile.collection.findOne(
      { user_id: user.user_id },
      { projection: { expertise: 1, tags: 1 } },
    )
    const addToSet = {}

    if (hasText(user.specialty) && !arrayHasValue(profile?.expertise, user.specialty.trim())) {
      addToSet.expertise = user.specialty.trim()
      if (dryRun) stats.wouldAddExpertise += 1
      else stats.addedExpertise += 1
    }

    if (hasText(user.expert_type) && !arrayHasValue(profile?.tags, user.expert_type.trim())) {
      addToSet.tags = user.expert_type.trim()
      if (dryRun) stats.wouldAddTag += 1
      else stats.addedTag += 1
    }

    if (!dryRun && Object.keys(addToSet).length > 0) {
      await UserProfile.updateOne(
        { user_id: user.user_id },
        { $addToSet: addToSet, $setOnInsert: { user_id: user.user_id } },
        { upsert: true, runValidators: true },
      )
    }
  }

  const expertUnsetFilter = {
    $or: [
      { is_expert: { $exists: true } },
      { is_verified_expert: { $exists: true } },
      { expert_type: { $exists: true } },
      { specialty: { $exists: true } },
    ],
  }

  if (dryRun) {
    stats.wouldUnsetExpertUsers = await User.collection.countDocuments(expertUnsetFilter)
  } else {
    const result = await User.collection.updateMany(
      expertUnsetFilter,
      { $unset: legacyExpertFields },
    )
    stats.unsetExpertUsers = result.modifiedCount
  }

  const broadProfileCursor = UserProfile.collection.find(
    {
      $or: [
        { kyc: { $exists: true } },
        { course: { $exists: true } },
        { files: { $exists: true } },
      ],
    },
    {
      projection: {
        user_id: 1,
        avatar_url: 1,
        credentials_url: 1,
        files: 1,
      },
    },
  )

  for await (const profile of broadProfileCursor) {
    stats.broadProfilesScanned += 1
    const set = {}

    if (hasText(profile.files?.profile_photo_url) && !hasText(profile.avatar_url)) {
      set.avatar_url = profile.files.profile_photo_url.trim()
      if (dryRun) stats.wouldCopyProfilePhoto += 1
      else stats.copiedProfilePhoto += 1
    }

    if (hasText(profile.files?.supporting_doc_url) && !hasText(profile.credentials_url)) {
      set.credentials_url = profile.files.supporting_doc_url.trim()
      if (dryRun) stats.wouldCopySupportingDoc += 1
      else stats.copiedSupportingDoc += 1
    }

    if (!dryRun && Object.keys(set).length > 0) {
      await UserProfile.collection.updateOne(
        { user_id: profile.user_id },
        { $set: set },
      )
    }
  }

  const broadProfileFilter = {
    $or: [
      { kyc: { $exists: true } },
      { course: { $exists: true } },
      { files: { $exists: true } },
    ],
  }

  if (dryRun) {
    stats.wouldUnsetBroadProfileObjects =
      await UserProfile.collection.countDocuments(broadProfileFilter)
  } else {
    const result = await UserProfile.collection.updateMany(
      broadProfileFilter,
      { $unset: legacyProfileObjects },
    )
    stats.unsetBroadProfileObjects = result.modifiedCount
  }

  console.log(JSON.stringify(stats, null, 2))
} finally {
  await mongoose.disconnect()
}
