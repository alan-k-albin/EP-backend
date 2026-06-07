import express from 'express'
import {
  getMyChats,
  getChatMessages,
  createChat,
  createGroupChat,
  sendMessage
} from '../controllers/chatController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', protect, getMyChats)
router.post('/create', protect, createChat)
router.post('/group', protect, createGroupChat)
router.get('/:id/messages', protect, getChatMessages)
router.post('/:id/messages', protect, sendMessage)

export default router