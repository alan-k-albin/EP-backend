import express from 'express'
import {
  createPost,
  getFeedPosts,
  getPost,
  updatePost,
  deletePost,
  reactToPost,
  getPostsByUser,
  attemptPost,
  getAttempted,
  bookmarkPost,
  getBookmarks,
  repostPost,
  getPostsByHashtag
} from '../controllers/postController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/', protect, createPost)
router.get('/feed', protect, getFeedPosts)
router.get('/bookmarks', protect, getBookmarks)
router.get('/user/:userId', protect, getPostsByUser)
router.get('/hashtag/:tag', protect, getPostsByHashtag)
router.get('/:id', protect, getPost)
router.put('/:id', protect, updatePost)
router.delete('/:id', protect, deletePost)
router.post('/:id/react', protect, reactToPost)
router.post('/:id/attempt', protect, attemptPost)
router.get('/:id/attempted', protect, getAttempted)
router.post('/:id/bookmark', protect, bookmarkPost)
router.post('/:id/repost', protect, repostPost)

export default router