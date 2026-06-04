import { Router } from 'express'
import multer from 'multer'
import { createAnswer } from '../controllers/answer.controller.js'
import {
  acceptAnswer,
  unacceptAnswer,
  createQuestion,
  deleteQuestion,
  downloadQuestionAttachment,
  getQuestionById,
  getQuestionCounts,
  listPublishedFAQs,
  listQuestions,
  listQuestionTags,
  recordQuestionView,
  resolveQuestion,
  updateQuestion,
  voteQuestion,
} from '../controllers/question.controller.js'
import { checkRole, verifyToken } from '../middleware/authMiddleware.js'
import { questionCreationLimiter } from '../middleware/rateLimit.middleware.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg']
    if (!allowed.includes(file.mimetype)) {
      const error = new Error('Only PDF, JPG and PNG attachments are allowed')
      error.statusCode = 400
      return cb(error)
    }
    cb(null, true)
  },
})

const router = Router()

/**
 * @openapi
 * /api/faqs:
 *   get:
 *     summary: List all published FAQs grouped by tag (public, no auth)
 *     tags: [FAQs]
 *     responses:
 *       200:
 *         description: FAQs grouped by tag
 */
router.get('/faqs', listPublishedFAQs)

router.use(verifyToken)

/**
 * @openapi
 * /api/questions:
 *   post:
 *     summary: Create a question
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 300
 *                 example: Internship start date clarification
 *               body:
 *                 type: string
 *                 example: Need clarification regarding internship joining date.
 *               category:
 *                 type: string
 *                 example: internship
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [internship, joining]
 *               sparkBounty:
 *                 type: number
 *                 example: 20
 *     responses:
 *       201:
 *         description: Question created
 *       400:
 *         description: Validation failed
 *       403:
 *         description: Forbidden
 */
router.post('/', questionCreationLimiter, checkRole('USER', 'RESOLVER', 'ADMIN'), upload.array('attachments', 5), createQuestion)

/**
 * @openapi
 * /api/questions:
 *   get:
 *     summary: List questions with optional filters
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search across title, body, and tags
 *         example: internship
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         example: forms
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         example: joining
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, resolved, unanswered, answered, closed, removed]
 *         example: open
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [trending, latest]
 *         example: latest
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 20
 *     responses:
 *       200:
 *         description: Paginated list of questions
 */
router.get('/', checkRole('USER', 'RESOLVER', 'ADMIN'), listQuestions)

/**
 * @openapi
 * /api/questions/tags:
 *   get:
 *     summary: List distinct tags across community questions, ranked by usage
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Distinct tags with counts
 */
router.get('/tags', checkRole('USER', 'RESOLVER', 'ADMIN'), listQuestionTags)

router.get('/counts', checkRole('USER', 'RESOLVER', 'ADMIN'), getQuestionCounts)

/**
 * @openapi
 * /api/questions/{questionId}:
 *   get:
 *     summary: Get question by ID (includes answers and comments)
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *       - in: query
 *         name: includeAnswers
 *         schema:
 *           type: boolean
 *         example: true
 *       - in: query
 *         name: includeComments
 *         schema:
 *           type: boolean
 *         example: true
 *     responses:
 *       200:
 *         description: Question details with answers and comments
 *       404:
 *         description: Question not found
 */
router.get('/:questionId', checkRole('USER', 'RESOLVER', 'ADMIN'), getQuestionById)
router.get('/:questionId/attachments/:attachmentId', checkRole('USER', 'RESOLVER', 'ADMIN'), downloadQuestionAttachment)

/**
 * @openapi
 * /api/questions/{questionId}/view:
 *   post:
 *     summary: Record a question view (once per user, author excluded)
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: View recorded or already exists
 *       404:
 *         description: Question not found
 */
router.post('/:questionId/view', checkRole('USER', 'RESOLVER', 'ADMIN'), recordQuestionView)

/**
 * @openapi
 * /api/questions/{questionId}:
 *   patch:
 *     summary: Update a question
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Question updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Question not found
 *       409:
 *         description: Question locked or resolved
 */
router.patch('/:questionId', checkRole('USER', 'RESOLVER', 'ADMIN'), updateQuestion)

/**
 * @openapi
 * /api/questions/{questionId}:
 *   delete:
 *     summary: Soft-delete a question (sets status to removed)
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Question deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Question not found
 */
router.delete('/:questionId', checkRole('USER', 'ADMIN'), deleteQuestion)

/**
 * @openapi
 * /api/questions/{questionId}/answers:
 *   post:
 *     summary: Submit an answer to a question
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Answer submitted
 *       404:
 *         description: Question not found
 */
router.post('/:questionId/vote', checkRole('USER', 'RESOLVER', 'ADMIN'), voteQuestion)
router.patch('/:questionId/resolve', checkRole('USER', 'RESOLVER', 'ADMIN'), resolveQuestion)
router.post('/:questionId/answers', checkRole('USER', 'RESOLVER', 'ADMIN'), createAnswer)

/**
 * @openapi
 * /api/questions/{questionId}/accept-answer/{answerId}:
 *   post:
 *     summary: Accept an answer and optionally award spark bounty
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: answerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Answer accepted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Question or answer not found
 *       409:
 *         description: Answer already accepted
 */
router.post('/:questionId/accept-answer/:answerId', checkRole('USER', 'ADMIN'), acceptAnswer)
router.delete('/:questionId/accept-answer/:answerId', checkRole('ADMIN'), unacceptAnswer)

export default router
