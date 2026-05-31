import { Router } from 'express'
import {
  assignUserRole,
  createTag,
  createUser,
  deleteTag,
  getAdminDashboard,
  listAdminSparkTransactions,
  listTags,
  removeUserRole,
  renameTag,
} from '../controllers/admin.controller.js'
import { checkRole, verifyToken } from '../middleware/authMiddleware.js'

const router = Router()

router.use(verifyToken, checkRole('ADMIN'))

/**
 * @openapi
 * /api/admin/dashboard:
 *   get:
 *     summary: Get platform metrics for the admin dashboard
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Dashboard metrics.
 */
router.get('/dashboard', getAdminDashboard)
router.post('/users/:userId/roles', assignUserRole)
router.delete('/users/:userId/roles/:roleName', removeUserRole)
router.post('/users', createUser)
router.get('/sparks/transactions', listAdminSparkTransactions)

router.get('/tags', listTags)
router.post('/tags', createTag)
router.patch('/tags/:tagName', renameTag)
router.delete('/tags/:tagName', deleteTag)

export default router
