import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../../config/db.js'
import SparkTransaction from '../../models/spark-transaction.model.js'
import User from '../../models/user.model.js'

const apply = process.argv.includes('--apply')
const dryRun = !apply

const stats = {
  mode: dryRun ? 'dry-run' : 'apply',
  usersScanned: 0,
  balancedUsers: 0,
  wouldUpdateUsers: 0,
  updatedUsers: 0,
  orphanTransactionUsers: 0,
}

try {
  await connectDB()

  const rows = await SparkTransaction.aggregate([
    {
      $group: {
        _id: '$user_id',
        balance: { $sum: '$points' },
      },
    },
  ])
  const balanceByUserId = new Map(rows.map((row) => [row._id, row.balance || 0]))
  const seenUserIds = new Set()
  const users = await User.find().select('user_id spark_points').lean()

  for (const user of users) {
    stats.usersScanned += 1
    seenUserIds.add(user.user_id)

    const ledgerBalance = balanceByUserId.get(user.user_id) || 0
    const cachedBalance = user.spark_points || 0

    if (cachedBalance === ledgerBalance) {
      stats.balancedUsers += 1
      continue
    }

    if (dryRun) {
      stats.wouldUpdateUsers += 1
      continue
    }

    await User.updateOne(
      { user_id: user.user_id },
      { $set: { spark_points: ledgerBalance } },
      { runValidators: true },
    )
    stats.updatedUsers += 1
  }

  for (const userId of balanceByUserId.keys()) {
    if (!seenUserIds.has(userId)) {
      stats.orphanTransactionUsers += 1
    }
  }

  console.log(JSON.stringify(stats, null, 2))
} finally {
  await mongoose.disconnect()
}
