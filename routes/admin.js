import express from 'express'
import {
  getStats,
  getAllUsers,
  deleteUser,
  banUser,
  promoteUser,
  getAllPosts,
  adminDeletePost,
  getPendingVerifications,
  approveVerification,
  rejectVerification,
  getAllReports,
  resolveReport,
} from '../controllers/adminController.js'
import protect from '../middleware/authMiddleware.js'
import adminOnly from '../middleware/adminMiddleware.js'

const router = express.Router()

// All routes protected by both protect and adminOnly
router.get('/stats', protect, adminOnly, getStats)

router.get('/users', protect, adminOnly, getAllUsers)
router.delete('/users/:userId', protect, adminOnly, deleteUser)
router.put('/users/:userId/ban', protect, adminOnly, banUser)
router.put('/users/:userId/promote', protect, adminOnly, promoteUser)

router.get('/posts', protect, adminOnly, getAllPosts)
router.delete('/posts/:postId', protect, adminOnly, adminDeletePost)

router.get('/verifications', protect, adminOnly, getPendingVerifications)
router.put('/verifications/:verificationId/approve', protect, adminOnly, approveVerification)
router.put('/verifications/:verificationId/reject', protect, adminOnly, rejectVerification)

router.get('/reports', protect, adminOnly, getAllReports)
router.put('/reports/:reportId/resolve', protect, adminOnly, resolveReport)

export default router