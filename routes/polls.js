import express from 'express'
import { createPoll, getPoll, votePoll } from '../controllers/pollController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/', protect, createPoll)
router.get('/:postId', protect, getPoll)
router.post('/vote', protect, votePoll)

export default router