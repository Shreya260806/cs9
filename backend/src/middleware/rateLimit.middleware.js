import { rateLimit, ipKeyGenerator } from 'express-rate-limit'

/**
 * Rate limiter: max 5 questions per 10 minutes per user.
 * Keyed by userId from the JWT (falls back to IP for unauthenticated requests,
 * which should not reach here thanks to verifyToken, but is safe to keep).
 */
export const questionCreationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // req.user is populated by verifyToken middleware (runs before this limiter)
    return req.user?.userId || ipKeyGenerator(req, req.res)
  },
  message: {
    success: false,
    message: 'Too many questions created. Please wait before posting again.',
  },
  skip: (req) => {
    // Only apply to POST /api/questions
    return false // always apply; route-level application makes this a no-op elsewhere
  },
})
