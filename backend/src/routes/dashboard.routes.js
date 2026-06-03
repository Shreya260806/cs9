import { Router } from 'express'
import { registerDashboardEvents } from '../services/dashboard-events.service.js'
import { checkRole, verifyToken } from '../middleware/authMiddleware.js'

const router = Router()

router.get('/events', verifyToken, checkRole('USER', 'RESOLVER', 'ADMIN'), registerDashboardEvents)

export default router
