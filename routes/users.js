import express from 'express'
import {
  getMyProfile,
  getUserProfile,
  updateProfile,
  addExperience,
  addEducation,
  addSkill,
  searchUsers,
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportContent
} from '../controllers/userController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/me', protect, getMyProfile)
router.get('/search', protect, searchUsers)
router.get('/blocked', protect, getBlockedUsers)
router.get('/:id', protect, getUserProfile)
router.put('/me', protect, updateProfile)
router.post('/me/experience', protect, addExperience)
router.post('/me/education', protect, addEducation)
router.post('/me/skill', protect, addSkill)
router.post('/block', protect, blockUser)
router.delete('/block/:id', protect, unblockUser)
router.post('/report', protect, reportContent)

export default router