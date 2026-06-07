import express from 'express'
import {
  getNotifications,
  markAsRead,
  getUnreadCount
} from '../controllers/notificationController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', protect, getNotifications)
router.get('/unread', protect, getUnreadCount)
router.put('/read', protect, markAsRead)

export default router