import { Router } from 'express'
import {
  getUserById,
  getUserContributions,
  getMyContributions,
  listUsers,
  updateUserStatus,
} from '../controllers/user.controller.js'
import { checkRole, verifyToken } from '../middleware/authMiddleware.js'

const router = Router()

router.use(verifyToken)

// Block ADMINs from user-scoped (self-service) routes — they belong in the admin
// views. NOTE: the ADMIN management endpoints (list users, change status) are
// served from this router too and are guarded with checkRole('ADMIN') instead,
// so this block must NOT be applied router-wide or those endpoints become
// unreachable (admin blocked here, non-admin blocked by checkRole → 403 for all).
function blockAdmins(req, res, next) {
  if (req.user?.roles?.includes('ADMIN')) {
    return res.status(403).json({ message: 'Admins cannot access user routes' })
  }
  next()
}

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: List and filter users for administration
 *     tags: [Users, Admin]
 *     responses:
 *       200:
 *         description: Paginated users.
 *       403:
 *         description: ADMIN role required.
 */
// ADMIN user-management endpoints (the admin dashboard calls these).
router.get('/', checkRole('ADMIN'), listUsers)
router.patch('/:userId/status', checkRole('ADMIN'), updateUserStatus)

// User self-service endpoints — blocked for ADMINs.
router.get('/me/contributions', blockAdmins, getMyContributions)
router.get('/:userId', blockAdmins, getUserById)
router.get('/:userId/contributions', blockAdmins, getUserContributions)

export default router
