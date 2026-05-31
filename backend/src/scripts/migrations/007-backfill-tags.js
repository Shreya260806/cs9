/**
 * 007-backfill-tags.js
 * Seeds the Tag collection from all tags that already exist on questions.
 * Safe to re-run — uses upsert to avoid duplicates.
 *
 * Usage:
 *   node scripts/migrations/007-backfill-tags.js
 */

import '../../src/db.js'
import Question from '../../src/models/question.model.js'
import Tag from '../../src/models/tag.model.js'

async function backfill() {
  console.log('Collecting all tags from questions…')
  const questions = await Question.find({}, { tags: 1 }).lean()
  const tagMap = new Map()
  for (const q of questions) {
    for (const t of q.tags || []) {
      const name = t.toLowerCase().trim()
      if (!name) continue
      tagMap.set(name, (tagMap.get(name) || 0) + 1)
    }
  }

  console.log(`Found ${tagMap.size} unique tags across ${questions.length} questions.`)
  if (tagMap.size === 0) {
    console.log('Nothing to backfill. Exiting.')
    process.exit(0)
  }

  const ops = []
  for (const [name, count] of tagMap) {
    ops.push({
      updateOne: {
        filter: { name },
        update: { $setOnInsert: { name, questionCount: count } },
        upsert: true,
      },
    })
  }

  const result = await Tag.bulkWrite(ops)
  console.log(`Upserted: ${result.upsertedCount} | Modified: ${result.modifiedCount} | Matched: ${result.matchedCount}`)
  console.log('Done.')
  process.exit(0)
}

backfill().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})