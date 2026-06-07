import express from 'express'
import {
  addComment,
  getComments,
  deleteComment,
  addReply,
  getReplies
} from '../controllers/commentController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/:id/comments', protect, addComment)
router.get('/:id/comments', protect, getComments)
router.delete('/comments/:commentId', protect, deleteComment)
router.post('/comments/:commentId/replies', protect, addReply)
router.get('/comments/:commentId/replies', protect, getReplies)

export default router