import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import swaggerUi from 'swagger-ui-express'
import swaggerSpec from './config/swagger.js'
import { errorHandler, notFound } from './middleware/error.middleware.js'
import { listPublishedFAQs } from './controllers/question.controller.js'
import adminRoutes from './routes/admin.routes.js'
import answerRoutes from './routes/answer.routes.js'
import authRoutes from './routes/auth.routes.js'
import commentRoutes from './routes/comment.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import flagRoutes from './routes/flag.routes.js'
import leaderboardRoutes from './routes/leaderboard.routes.js'
import moderationRoutes from './routes/moderation.routes.js'
import notificationRoutes from './routes/notification.routes.js'
import profileRoutes from './routes/profile.routes.js'
import questionRoutes from './routes/question.routes.js'
import resolverRoutes from './routes/resolver.routes.js'
import sparkRoutes from './routes/spark.routes.js'
import userRoutes from './routes/user.routes.js'

const app = express()

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : null

function isLocalDevelopmentOrigin(origin) {
  if (!origin) return true

  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function allowCorsOrigin(origin, callback) {
  if (allowedOrigins) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`))
    }
    return
  }

  if (isLocalDevelopmentOrigin(origin)) {
    callback(null, true)
  } else {
    callback(new Error(`CORS: origin ${origin} not allowed`))
  }
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

app.use(
  cors({
    origin: allowCorsOrigin,
    credentials: true,
  }),
)

app.use(express.json({ limit: '10kb' }))

/** Global rate limit: 500 requests per 5 minutes per IP */
const globalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
})
app.use(globalLimiter)

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.get('/api/docs.json', (_req, res) => {
  res.json(swaggerSpec)
})

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Check service health
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Backend service is available.
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'rogare-backend',
    timestamp: new Date().toISOString(),
  })
})

/**
 * @openapi
 * /:
 *   get:
 *     summary: Get the API welcome message
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API is running.
 */
app.get('/', (_req, res) => {
  res.json({ message: 'Rogāre API is running' })
})

/** Public FAQ listing (no auth) */
app.get('/api/faqs', listPublishedFAQs)

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/questions', questionRoutes)
app.use('/api/answers', answerRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/flags', flagRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/sparks', sparkRoutes)
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/resolver', resolverRoutes)
app.use('/api/moderation', moderationRoutes)

app.use(notFound)
app.use(errorHandler)

export default app
