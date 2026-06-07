import express from 'express'
import {
  getMyProfile,
  getUserProfile,
  updateProfile,
  addExperience,
  addEducation,
  addSkill,
  searchUsers
} from '../controllers/userController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/me', protect, getMyProfile)
router.get('/search', protect, searchUsers)
router.get('/:id', protect, getUserProfile)
router.put('/me', protect, updateProfile)
router.post('/me/experience', protect, addExperience)
router.post('/me/education', protect, addEducation)
router.post('/me/skill', protect, addSkill)

export default router