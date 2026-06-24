import express from 'express'
import {
  getMyChats,
  getUnreadChatCount,
  markChatAsRead,
  getChatMessages,
  createChat,
  createGroupChat,
  sendMessage,
  getChatInfo
} from '../controllers/chatController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', protect, getMyChats)
router.get('/unread-count', protect, getUnreadChatCount)
router.post('/create', protect, createChat)
router.post('/group', protect, createGroupChat)
router.get('/:id/info', protect, getChatInfo)
router.get('/:id/messages', protect, getChatMessages)
router.post('/:id/messages', protect, sendMessage)
router.put('/:id/read', protect, markChatAsRead)

export default router