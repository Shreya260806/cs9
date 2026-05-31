import { Router } from 'express'
import { getLeaderboard } from '../controllers/spark.controller.js'
import { checkRole, verifyToken } from '../middleware/authMiddleware.js'

const router = Router()

router.get('/', verifyToken, checkRole('USER', 'RESOLVER', 'ADMIN'), (req, res, next) => {
  // Pass isAdmin so the controller can show real names to admins
  req.isAdmin = req.user.role === 'ADMIN'
  next()
}, getLeaderboard)

export default router
