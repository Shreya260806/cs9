import 'dotenv/config'
import fs from 'fs'
import { randomUUID } from 'crypto'
import connectDB, { faqConnection } from '../config/db.js'
import Question from '../models/question.model.js'
import FAQQuestion from '../models/faq.model.js'
import User from '../models/user.model.js'

const CATEGORY_MAPPING = {
  "About the internship": "About the Internship",
  "Timing and dates": "Timing & Dates",
  "NOC (No Objection Certificate)": "NOC & Onboarding",
  "Selection, offer letter, and certificate": "Selection, Offer & Certificate",
  "Work, mentorship, and projects": "Projects & Mentorship",
  "Code of conduct — communication channels": "Code of Conduct & Channels",
  "Interviews Related": "Interviews",
  "Certificate": "Selection, Offer & Certificate",
  "Rosetta — your internship journal": "Rosetta Journal",
  "Phase 1 — coursework, Vibe LMS, and live sessions": "ViBe Platform & Learning",
  "Spurti Points": "ViBe Platform & Learning",
  "Yaksha Chat Related": "ViBe Platform & Learning",
  "ViBe Platform": "ViBe Platform & Learning",
  "Team Formation": "Team Formation"
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general'
}

async function main() {
  await connectDB()

  // Wait for the FAQ database connection to be fully open
  if (faqConnection.readyState !== 1) {
    await new Promise((resolve) => faqConnection.once('open', resolve))
  }

  // Clear existing FAQ database to prevent duplicate categories/leftovers
  await FAQQuestion.deleteMany({})
  console.log('Cleared existing FAQ database.')

  // Get admin as author
  const admin = await User.findOne({ email: 'admin@gmail.com' }) || await User.findOne({ roles: 'ADMIN' })
  if (!admin) {
    throw new Error('Admin user not found')
  }

  // 1. First, migrate existing FAQs from rogare to samagama-faqs with category mapping
  const existingFaqs = await Question.find({ kind: 'faq' }).lean()
  console.log(`Found ${existingFaqs.length} existing FAQs in main database. Migrating with category mapping...`)

  let migratedCount = 0
  for (const faq of existingFaqs) {
    const cleanFaq = { ...faq }
    delete cleanFaq._id
    delete cleanFaq.id
    
    // Map existing tags to the new unified categories
    let mappedCategory = 'About the Internship'
    const titleLower = cleanFaq.title.toLowerCase()
    
    if (titleLower.includes('vibe') || titleLower.includes('journal')) {
      mappedCategory = 'ViBe Platform & Learning'
    } else if (titleLower.includes('certificate') || titleLower.includes('selection')) {
      mappedCategory = 'Selection, Offer & Certificate'
    } else if (titleLower.includes('noc') || titleLower.includes('onboarding')) {
      mappedCategory = 'NOC & Onboarding'
    } else if (titleLower.includes('start') || titleLower.includes('date') || titleLower.includes('leave') || titleLower.includes('timeline')) {
      mappedCategory = 'Timing & Dates'
    }

    const duplicate = await FAQQuestion.findOne({
      $or: [
        { question_id: cleanFaq.question_id },
        { title: cleanFaq.title }
      ]
    })
    
    if (!duplicate) {
      await FAQQuestion.create({
        ...cleanFaq,
        kind: 'faq',
        category: mappedCategory,
        tags: [mappedCategory],
        status: 'published',
        visibility: 'public',
        moderation_status: 'approved',
      })
      migratedCount++
    }
  }
  console.log(`Migrated ${migratedCount} FAQs from main database.`)

  // 2. Parse and ingest from URL markdown
  const filePath = process.argv[2] || process.env.FAQ_CONTENT_FILE
  if (!filePath) {
    throw new Error(
      'FAQ content file path not provided. Pass it as a CLI argument:\n' +
      '  node backend/src/scripts/ingest-url-faqs.js <path-to-content.md>\n' +
      'Or set FAQ_CONTENT_FILE in backend/.env'
    )
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`FAQ content file not found at: ${filePath}`)
  }

  const content = fs.readFileSync(filePath, 'utf8')

  // Split content by h2 tags
  const rawSections = []
  const h2Regex = /<h2\s+id="s-\d+">(\d+)\.\s*([^<]+)/g
  let match
  let lastIndex = 0
  let lastSectionTitle = null

  while ((match = h2Regex.exec(content)) !== null) {
    if (lastSectionTitle) {
      rawSections.push({
        title: lastSectionTitle,
        body: content.slice(lastIndex, match.index)
      })
    }
    lastSectionTitle = match[2].trim()
    lastIndex = h2Regex.lastIndex
  }
  if (lastSectionTitle) {
    rawSections.push({
      title: lastSectionTitle,
      body: content.slice(lastIndex)
    })
  }

  let ingested = 0
  let skipped = 0
  let total = 0

  for (const section of rawSections) {
    const category = section.title
    const mappedCategory = CATEGORY_MAPPING[category] || category
    const detailsRegex = /<details\s+class="faq-q"\s+id="([^"]+)">([\s\S]*?)<\/details>/g
    let detailMatch

    while ((detailMatch = detailsRegex.exec(section.body)) !== null) {
      total++
      const detailsId = detailMatch[1]
      const inner = detailMatch[2]

      const summaryMatch = inner.match(/<summary>\s*(?:\d+\.\d+)?\s*([^<]+)/)
      if (!summaryMatch) {
        skipped++
        continue
      }

      const rawQuestion = summaryMatch[1].trim()
      const summaryEndIndex = inner.indexOf('</summary>')
      if (summaryEndIndex === -1) {
        skipped++
        continue
      }

      const rawAnswer = inner.slice(summaryEndIndex + 10).trim()

      // Skip empty or short QA
      if (rawQuestion.length < 5 || rawAnswer.length < 5) {
        skipped++
        continue
      }

      // Check for duplicate in FAQ database
      const existing = await FAQQuestion.findOne({
        $or: [
          { title: rawQuestion },
          { slug: slugify(rawQuestion) }
        ]
      })

      if (existing) {
        // Add tag to existing FAQ if it doesn't already have it
        if (!existing.tags.includes(mappedCategory)) {
          existing.tags.push(mappedCategory)
          await existing.save()
        }
        skipped++
        continue
      }

      // Create new FAQ
      await FAQQuestion.create({
        question_id: randomUUID(),
        kind: 'faq',
        title: rawQuestion,
        slug: slugify(rawQuestion),
        body: rawAnswer,
        body_plain: rawAnswer.replace(/<[^>]*>/g, '').trim(),
        category: mappedCategory,
        tags: [mappedCategory],
        author_id: admin.user_id,
        status: 'published',
        visibility: 'public',
        upvotes: 0,
        view_count: 0,
        answer_count: 0,
        moderation_status: 'approved',
      })
      ingested++
    }
  }

  console.log(`\nURL FAQs parsed: ${total}`)
  console.log(`Ingested to samagama-faqs: ${ingested}`)
  console.log(`Skipped (duplicates/errors): ${skipped}`)

  await import('mongoose').then((m) => m.default.disconnect())
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
