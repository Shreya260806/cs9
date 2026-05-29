/**
 * Full seed script — populates all collections with realistic dummy data.
 * Run: node src/scripts/seed-all.js
 */

import 'dotenv/config'
import argon2 from 'argon2'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import Role from '../models/role.model.js'
import User from '../models/user.model.js'
import UserProfile from '../models/user-profile.model.js'
import UserRoleMapper from '../models/user-role-mapper.model.js'
import Question from '../models/question.model.js'
import Answer from '../models/answer.model.js'
import Comment from '../models/comment.model.js'
import Notification from '../models/notification.model.js'
import Flag from '../models/flag.model.js'
import { ensureRole, getMappedRoles } from '../services/role.service.js'
import { awardSpark, reserveBounty } from '../services/spark.service.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripBody(html) {
  return html.replace(/<[^>]*>/g, '').trim()
}

// ─── Roles ────────────────────────────────────────────────────────────────────

async function seedRoles() {
  const roles = await Promise.all(['USER', 'RESOLVER', 'ADMIN'].map(ensureRole))
  console.log(`✓ Roles seeded: ${roles.map((r) => r.name).join(', ')}`)
  return roles
}

// ─── Users ────────────────────────────────────────────────────────────────────

async function seedUsers() {
  const adminRole = await ensureRole('ADMIN')
  const resolverRole = await ensureRole('RESOLVER')
  const userRole = await ensureRole('USER')

  const users = [
    {
      name: 'Portal Admin',
      email: 'admin@gmail.com',
      password: 'Admin123@',
      role: 'ADMIN',
      is_expert: false,
      spark_points: 100,
    },
    {
      name: 'Ravi Sharma',
      email: 'ravi.sharma@gmail.com',
      password: 'Resolver123@',
      role: 'RESOLVER',
      is_expert: true,
      is_verified_expert: true,
      expert_type: 'Lab Coordinator',
      specialty: 'NOC & Onboarding',
      spark_points: 85,
    },
    {
      name: 'Priya Mehta',
      email: 'priya.mehta@gmail.com',
      password: 'User1234@',
      role: 'USER',
      spark_points: 42,
    },
    {
      name: 'Arjun Nair',
      email: 'arjun.nair@gmail.com',
      password: 'User1234@',
      role: 'USER',
      spark_points: 28,
    },
    {
      name: 'Sneha Gupta',
      email: 'sneha.gupta@gmail.com',
      password: 'User1234@',
      role: 'USER',
      spark_points: 15,
    },
    {
      name: 'Karan Patel',
      email: 'karan.patel@gmail.com',
      password: 'User1234@',
      role: 'USER',
      spark_points: 33,
    },
    {
      name: 'Meera Iyer',
      email: 'meera.iyer@gmail.com',
      password: 'User1234@',
      role: 'USER',
      spark_points: 19,
    },
  ]

  const created = []
  for (const u of users) {
    const existing = await User.findOne({ email: u.email })
    if (existing) {
      console.log(`  ↹ Skipping existing user: ${u.email}`)
      created.push(existing)
      continue
    }

    const passwordHash = await argon2.hash(u.password)
    const user = await User.create({
      name: u.name,
      email: u.email,
      passwordHash,
      status: 'active',
    })

    const role = await ensureRole(u.role)
    await UserRoleMapper.create({ user_id: user.user_id, role_id: role.role_id })
    await UserProfile.create({
      user_id: user.user_id,
      display_name: user.name,
      expertise: u.specialty ? [u.specialty] : [],
      tags: u.expert_type ? [u.expert_type] : [],
    })

    if (u.spark_points > 0) {
      await awardSpark({
        userId: user.user_id,
        action: 'SEED_INITIAL_BALANCE',
        points: u.spark_points,
      })
    }

    console.log(`  ✓ Created user: ${u.email}`)
    created.push(user)
  }

  return created
}

// ─── FAQ Questions ────────────────────────────────────────────────────────────

async function seedFAQs(adminUser, resolverUser) {
  const faqs = [
    {
      title: 'What is the NOC deadline for the internship program?',
      body: '<p>The NOC (No Objection Certificate) must be submitted within <strong>7 days</strong> of receiving your offer letter. Failure to do so may result in your seat being offered to the waitlist candidate. Please ensure the NOC is signed by your college principal or authorized signatory and uploaded via the ViBe platform under the NOC section.</p>',
      tags: ['noc', 'deadline', 'documents'],
      slug: 'noc-deadline-internship',
      status: 'published',
      author_id: resolverUser.user_id,
    },
    {
      title: 'When does the internship start date officially begin?',
      body: '<p>The official internship start date is mentioned in your offer letter, generally the <strong>1st of the month</strong> following your selection. For example, if you are selected in June, your internship begins on <strong>1st July</strong>. Any deviation requires prior written approval from the Lab Coordinator.</p>',
      tags: ['start-date', 'timeline', 'joining'],
      slug: 'internship-start-date',
      status: 'published',
      author_id: resolverUser.user_id,
    },
    {
      title: 'How do I access the ViBe platform for daily journaling?',
      body: '<p>The ViBe platform can be accessed at <code>vibe.iitrpr.ac.in</code> using your institute email credentials. Navigate to the <strong>Rosetta Journal</strong> section to log your daily activities. Entries must be submitted by <strong>9:00 PM daily</strong> and reviewed by your assigned mentor every week.</p>',
      tags: ['vibe', 'platform', 'journal', 'rosetta'],
      slug: 'vibe-platform-access',
      status: 'published',
      author_id: resolverUser.user_id,
    },
    {
      title: 'What is the selection process for the internship?',
      body: '<p>The selection process consists of three stages: <ol><li>Application screening (GPA + statement of purpose)</li><li>Technical interview (online via Google Meet)</li><li>Final offer roll-out via email within 48 hours of the interview</li></ol>Shortlisted candidates are notified 1 week before the interview date.</p>',
      tags: ['selection', 'interview', 'process'],
      slug: 'selection-process',
      status: 'published',
      author_id: resolverUser.user_id,
    },
    {
      title: 'How do I claim my internship completion certificate?',
      body: '<p>Upon successful completion of the internship (minimum 8 weeks, all journal entries submitted, NOC submitted), your certificate is auto-generated from the <strong>ViBe platform</strong> under the <em>Certificates</em> tab. Processing takes <strong>5–7 working days</strong> after your last day.</p>',
      tags: ['certificate', 'completion', 'internship'],
      slug: 'completion-certificate',
      status: 'published',
      author_id: resolverUser.user_id,
    },
  ]

  const created = []
  for (const faq of faqs) {
    const existing = await Question.findOne({ slug: faq.slug })
    if (existing) {
      console.log(`  ↹ Skipping existing FAQ: ${faq.slug}`)
      created.push(existing)
      continue
    }

    const question = await Question.create({
      ...faq,
      kind: 'faq',
      body_plain: stripBody(faq.body),
      moderation_status: 'approved',
      upvotes: Math.floor(Math.random() * 50) + 10,
      view_count: Math.floor(Math.random() * 200) + 20,
      answer_count: 1,
      has_expert_answer: true,
      last_activity_at: new Date(),
    })

    const answerBody = `<p>This is the official answer verified by the Lab Coordinator. For further assistance, please contact the support team via the <strong>Lab Support</strong> channel on the platform.</p>`
    await Answer.create({
      question_id: question.question_id,
      question_kind: 'faq',
      author_id: resolverUser.user_id,
      author_role: 'RESOLVER',
      body: answerBody,
      body_plain: stripBody(answerBody),
      is_expert: true,
      is_official: true,
      is_accepted: true,
      upvotes: Math.floor(Math.random() * 30) + 5,
      score: Math.floor(Math.random() * 30) + 5,
      moderation_status: 'approved',
    })

    console.log(`  ✓ Created FAQ: ${question.slug}`)
    created.push(question)
  }

  return created
}

// ─── Discussion Questions ─────────────────────────────────────────────────────

async function seedDiscussions(users) {
  const resolverUser = users[1]

  const discussions = [
    // UNANSWERED
    {
      title: 'Can I delay my joining date by 2 weeks due to college exams?',
      body: '<p>My college end-semester exams are scheduled until the 15th of July. My offer letter says joining on 1st July. Is it possible to request a delayed joining? Will this affect my selection status?</p>',
      tags: ['joining', 'exams', 'delay'],
      author_id: users[2].user_id,
      spark_bounty: 20,
      status: 'answered',
    },
    {
      title: 'My NOC is signed by the Dean — will that be accepted?',
      body: '<p>My college doesn\'t have a designated principal at the moment. The Dean has signed my NOC. Is this acceptable or do I need to get it re-signed by an authorized principal?</p>',
      tags: ['noc', 'document', 'dean'],
      author_id: users[3].user_id,
      spark_bounty: 0,
      status: 'unanswered',
    },
    {
      title: 'ViBe platform login not working — getting 403 error',
      body: '<p>I\'ve been trying to log into the ViBe platform since morning but I keep getting a 403 Forbidden error. I\'ve reset my password twice. Is there a known outage? My institute email is arjun.nair@student.iitrpr.ac.in</p>',
      tags: ['vibe', 'login', 'error', 'platform'],
      author_id: users[3].user_id,
      spark_bounty: 10,
      status: 'unanswered',
    },
    {
      title: 'How should team formation be done for group projects?',
      body: '<p>Are teams formed by the coordinators or do we need to form our own teams? If we form our own, what is the maximum team size? Also, is cross-discipline teaming allowed?</p>',
      tags: ['team', 'project', 'team-formation'],
      author_id: users[4].user_id,
      spark_bounty: 0,
      status: 'unanswered',
    },
    {
      title: 'Can I convert from part-time to full-time internship mid-way?',
      body: '<p>I initially selected part-time because of my coursework load. Now I realize I can manage full-time. Is it possible to convert mid-way? What is the process?</p>',
      tags: ['part-time', 'full-time', 'conversion'],
      author_id: users[2].user_id,
      spark_bounty: 15,
      status: 'unanswered',
    },
    // UNANSWERED — MORE
    {
      title: 'Is there a stipend advance option available for the first month?',
      body: '<p>The hostel rent is due before my first stipend arrives. Is there any provision for a stipend advance or early payment? The amount would be around ₹5,000–₹8,000.</p>',
      tags: ['stipend', 'payment', 'advance'],
      author_id: users[5].user_id,
      spark_bounty: 10,
      status: 'unanswered',
    },
    {
      title: 'Can external interns from other IITs join via this program?',
      body: '<p>I\'m a student at another IIT interested in the VINS program. Is the internship open to external candidates or only for IIT Ropar students?</p>',
      tags: ['eligibility', 'external', 'iit'],
      author_id: users[6].user_id,
      spark_bounty: 0,
      status: 'unanswered',
    },
    {
      title: 'What is the weekly time commitment expected from part-time interns?',
      body: '<p>I want to take up a part-time internship alongside my semester. How many hours per week are expected on average? Is there flexibility in scheduling?</p>',
      tags: ['part-time', 'hours', 'schedule'],
      author_id: users[4].user_id,
      spark_bounty: 0,
      status: 'unanswered',
    },
    // ANSWERED (not resolved)
    {
      title: 'Is there a travel allowance for interns reporting to campus?',
      body: '<p>I\'m coming from a different city. Will the program reimburse travel costs for reporting to campus at the beginning of the internship?</p>',
      tags: ['travel', 'allowance', 'reimbursement'],
      author_id: users[5].user_id,
      spark_bounty: 0,
      status: 'answered',
    },
    {
      title: 'Can I use the lab facilities after 6 PM for my project work?',
      body: '<p>I want to work on my project in the lab after regular hours. Is there extended lab access available? Who do I need to ask for permission?</p>',
      tags: ['lab', 'facilities', 'access', 'hours'],
      author_id: users[6].user_id,
      spark_bounty: 5,
      status: 'answered',
    },
    // RESOLVED
    {
      title: 'How do I update my display name shown on the platform?',
      body: '<p>I logged in with my institute email and my full name is showing. I want to use a shorter display name on the platform. Where can I change this?</p>',
      tags: ['profile', 'display-name', 'settings'],
      author_id: users[2].user_id,
      spark_bounty: 0,
      status: 'closed',
    },
    {
      title: 'I forgot my ViBe password — how do I reset it?',
      body: '<p>The "forgot password" link on ViBe keeps redirecting me to the IIT Ropar SSO page and I\'m stuck in a loop. How do I actually reset my password?</p>',
      tags: ['password', 'login', 'reset', 'vibe'],
      author_id: users[4].user_id,
      spark_bounty: 0,
      status: 'closed',
    },
  ]

  const created = []
  for (const disc of discussions) {
    const question = await Question.create({
      title: disc.title,
      body: disc.body,
      body_plain: stripBody(disc.body),
      tags: disc.tags,
      kind: 'community',
      author_id: disc.author_id,
      moderation_status: 'approved',
      status: disc.status,
      upvotes: Math.floor(Math.random() * 15),
      view_count: Math.floor(Math.random() * 80) + 5,
      answer_count: 0,
    })

    if (disc.spark_bounty > 0) {
      await reserveBounty(disc.author_id, disc.spark_bounty, question.question_id)
    }

    console.log(`  ✓ Created discussion [${disc.status}]: ${question.title.slice(0, 40)}…`)
    created.push({ question, disc })
  }

  return created
}

// ─── Answers ──────────────────────────────────────────────────────────────────

async function seedAnswers(discussions, users) {
  const resolverUser = users[1]
  const allAnswers = []

  // NOC delay — answered by resolver
  const delayQ = discussions[0].question
  const delayA = `<p>Yes, a delayed joining of up to <strong>2 weeks</strong> can be granted under exceptional circumstances including ongoing examinations. You need to:</p>
<ol><li>Submit a formal delay request via the ViBe platform before the joining date</li><li>Attach a scanned copy of your exam timetable as supporting document</li><li>Wait for approval from the Lab Coordinator (usually within 48 hours)</li></ol>
<p>Delays beyond 2 weeks may require fresh approval from the program director.</p>`

  const ans1 = await Answer.create({
    question_id: delayQ.question_id,
    question_kind: 'community',
    author_id: resolverUser.user_id,
    author_role: 'RESOLVER',
    body: delayA,
    body_plain: stripBody(delayA),
    is_expert: true,
    upvotes: 8,
    score: 8,
    moderation_status: 'approved',
  })
  allAnswers.push({ answer: ans1, question: delayQ })

  await Question.updateOne(
    { question_id: delayQ.question_id },
    { $set: { status: 'answered', answer_count: 1, has_expert_answer: true } },
  )

  // Travel allowance — answered by resolver
  const travelQ = discussions[8].question
  const travelA = `<p>Currently, there is <strong>no travel allowance</strong> provided for reporting to campus. However, you can claim <strong>local transport reimbursement</strong> (up to ₹500/month) for any official travel undertaken during your internship. Keep all receipts and submit them via the ViBe platform by the last week of each month.</p>`
  const ans2 = await Answer.create({
    question_id: travelQ.question_id,
    question_kind: 'community',
    author_id: resolverUser.user_id,
    author_role: 'RESOLVER',
    body: travelA,
    body_plain: stripBody(travelA),
    is_expert: true,
    upvotes: 5,
    score: 5,
    moderation_status: 'approved',
  })
  allAnswers.push({ answer: ans2, question: travelQ })

  await Question.updateOne(
    { question_id: travelQ.question_id },
    { $set: { status: 'answered', answer_count: 1 } },
  )

  // Lab access — answered by another user
  const labQ = discussions[9].question
  const labA = `<p>Extended lab access is available up to <strong>9:00 PM</strong> on weekdays. You need to:</p>
<ol><li>Get your mentor\'s approval email</li><li>Submit it to the lab administrator (lab.admin@iitrpr.ac.in)</li><li>Your access card will be updated within 24 hours</li></ol>
<p>Weekend access requires special permission from the department head.</p>`
  const ans3 = await Answer.create({
    question_id: labQ.question_id,
    question_kind: 'community',
    author_id: users[2].user_id,
    author_role: 'USER',
    body: labA,
    body_plain: stripBody(labA),
    is_expert: false,
    upvotes: 3,
    score: 3,
    moderation_status: 'approved',
  })
  allAnswers.push({ answer: ans3, question: labQ })

  await Question.updateOne(
    { question_id: labQ.question_id },
    { $set: { status: 'answered', answer_count: 1 } },
  )

  // Display name — resolved with user answering
  const displayQ = discussions[10].question
  const displayA = `<p>Go to your <strong>Profile Settings</strong> page (click your avatar in the top-right). You can change your display name there — it will be shown to other users throughout the platform. Your institute email name remains unchanged for login purposes.</p>`
  const ans4 = await Answer.create({
    question_id: displayQ.question_id,
    question_kind: 'community',
    author_id: users[2].user_id,
    author_role: 'USER',
    body: displayA,
    body_plain: stripBody(displayA),
    is_expert: false,
    is_accepted: true,
    upvotes: 6,
    score: 6,
    moderation_status: 'approved',
  })
  allAnswers.push({ answer: ans4, question: displayQ })

  await Question.updateOne(
    { question_id: displayQ.question_id },
    { $set: { status: 'closed', answer_count: 1, has_expert_answer: false } },
  )

  // Password reset — resolved
  const pwdQ = discussions[11].question
  const pwdA = `<p>The password reset issue is a known bug with the SSO redirect. Here\'s the workaround:</p>
<ol><li>Go directly to <code>vibe.iitrpr.ac.in/auth/reset</code></li><li>Enter your institute email and submit</li><li>Check your email for the reset link (also check spam)</li></ol>
<p>If it still doesn\'t work, email <strong>lab.admin@iitrpr.ac.in</strong> with your enrollment number.</p>`
  const ans5 = await Answer.create({
    question_id: pwdQ.question_id,
    question_kind: 'community',
    author_id: resolverUser.user_id,
    author_role: 'RESOLVER',
    body: pwdA,
    body_plain: stripBody(pwdA),
    is_expert: true,
    is_accepted: true,
    upvotes: 12,
    score: 12,
    moderation_status: 'approved',
  })
  allAnswers.push({ answer: ans5, question: pwdQ })

  await Question.updateOne(
    { question_id: pwdQ.question_id },
    { $set: { status: 'closed', answer_count: 1, has_expert_answer: true } },
  )

  console.log(`  ✓ Created 5 answers across discussions`)
  return allAnswers
}

// ─── Comments ─────────────────────────────────────────────────────────────────

async function seedComments(allAnswers, users) {
  const asker = users[2]
  const anotherUser = users[4]
  const resolverUser = users[1]
  const yetAnother = users[5]

  // ── On NOC delay answer ──────────────────────────────────────────────────
  const c1 = await Comment.create({
    question_id: allAnswers[0].question.question_id,
    answer_id: allAnswers[0].answer.answer_id,
    author_id: asker.user_id,
    author_role: 'USER',
    body: 'Thank you! I have already submitted my exam timetable. Hope it gets approved quickly.',
    body_plain: 'Thank you! I have already submitted my exam timetable. Hope it gets approved quickly.',
    depth: 0,
    moderation_status: 'approved',
  })

  const c2 = await Comment.create({
    question_id: allAnswers[0].question.question_id,
    answer_id: allAnswers[0].answer.answer_id,
    author_id: resolverUser.user_id,
    author_role: 'RESOLVER',
    body: '@user Check your ViBe dashboard — approval usually comes within 24 hours during exam periods.',
    body_plain: '@user Check your ViBe dashboard — approval usually comes within 24 hours during exam periods.',
    depth: 1,
    parent_id: c1.comment_id,
    root_comment_id: c1.comment_id,
    moderation_status: 'approved',
  })

  const c3 = await Comment.create({
    question_id: allAnswers[0].question.question_id,
    answer_id: allAnswers[0].answer.answer_id,
    author_id: asker.user_id,
    author_role: 'USER',
    body: '@Ravi Sharma Approved! Got the confirmation email just now. Thank you so much!',
    body_plain: '@Ravi Sharma Approved! Got the confirmation email just now. Thank you so much!',
    depth: 1,
    parent_id: c2.comment_id,
    root_comment_id: c1.comment_id,
    moderation_status: 'approved',
  })

  await Comment.updateOne({ comment_id: c1.comment_id }, { $set: { reply_count: 2 } })
  await Answer.updateOne(
    { answer_id: allAnswers[0].answer.answer_id },
    { $set: { comment_count: 3, top_level_comment_count: 1 } },
  )

  console.log(`  ✓ NOC delay: 3 comments (depth 0 → reply → reply)`)

  // ── On lab access answer ─────────────────────────────────────────────────
  const c4 = await Comment.create({
    question_id: allAnswers[2].question.question_id,
    answer_id: allAnswers[2].answer.answer_id,
    author_id: yetAnother.user_id,
    author_role: 'USER',
    body: 'What about GPU access for deep learning projects? Is that also covered under extended lab access?',
    body_plain: 'What about GPU access for deep learning projects? Is that also covered under extended lab access?',
    depth: 0,
    moderation_status: 'approved',
  })

  const c5 = await Comment.create({
    question_id: allAnswers[2].question.question_id,
    answer_id: allAnswers[2].answer.answer_id,
    author_id: resolverUser.user_id,
    author_role: 'RESOLVER',
    body: '@user GPU access requires a separate application. Fill the form at vibe.iitrpr.ac.in/lab/gpu-request and it takes about 3 days to process.',
    body_plain: '@user GPU access requires a separate application. Fill the form at vibe.iitrpr.ac.in/lab/gpu-request and it takes about 3 days to process.',
    depth: 1,
    parent_id: c4.comment_id,
    root_comment_id: c4.comment_id,
    moderation_status: 'approved',
  })

  await Comment.updateOne({ comment_id: c4.comment_id }, { $set: { reply_count: 1 } })
  await Answer.updateOne(
    { answer_id: allAnswers[2].answer.answer_id },
    { $set: { comment_count: 2, top_level_comment_count: 1 } },
  )

  console.log(`  ✓ Lab access: 2 comments (depth 0 → reply)`)

  // ── On password reset answer ───────────────────────────────────────────────
  const c6 = await Comment.create({
    question_id: allAnswers[4].question.question_id,
    answer_id: allAnswers[4].answer.answer_id,
    author_id: anotherUser.user_id,
    author_role: 'USER',
    body: 'The direct reset URL worked for me! Should update the ViBe documentation with this workaround.',
    body_plain: 'The direct reset URL worked for me! Should update the ViBe documentation with this workaround.',
    depth: 0,
    moderation_status: 'approved',
  })

  await Answer.updateOne(
    { answer_id: allAnswers[4].answer.answer_id },
    { $set: { comment_count: 1, top_level_comment_count: 1 } },
  )

  console.log(`  ✓ Password reset: 1 comment`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔱 Rogāre — Full Seed Script\n')

  try {
    await connectDB()

    console.log('\n📦 Seeding roles...')
    const users = await seedUsers()

    console.log('\n📦 Seeding FAQs...')
    await seedFAQs(users[0], users[1])

    console.log('\n📦 Seeding Discussions...')
    const discussions = await seedDiscussions(users)

    console.log('\n📦 Seeding Answers...')
    const allAnswers = await seedAnswers(discussions, users)

    console.log('\n📦 Seeding Comments...')
    await seedComments(allAnswers, users)

    console.log('\n✅ Seed complete!\n')
    console.log('Admin login:')
    console.log('  Email:    admin@gmail.com')
    console.log('  Password: Admin123@\n')
    console.log('Other test accounts:')
    console.log('  Resolver: ravi.sharma@gmail.com / Resolver123@')
    console.log('  User:     priya.mehta@gmail.com / User1234@\n')
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message)
    console.error(err.stack)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
