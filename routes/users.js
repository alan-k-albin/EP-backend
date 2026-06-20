import express from 'express'
import {
  getMyProfile,
  getUserProfile,
  updateProfile,
  updatePrivacy,
  completeOnboarding,
  addExperience,
  updateExperience,
  deleteExperience,
  addEducation,
  updateEducation,
  deleteEducation,
  addSkill,
  changeUsername,
  deleteSkill,
  searchUsers,
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportContent
} from '../controllers/userController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

// IMPORTANT: specific routes must come before /:id
router.get('/me', protect, getMyProfile)
router.get('/search', protect, searchUsers)
router.get('/blocked', protect, getBlockedUsers)
router.put('/me', protect, updateProfile)
router.put('/privacy', protect, updatePrivacy)
router.put('/onboarding', protect, completeOnboarding)
router.post('/me/experience', protect, addExperience)
router.put('/me/experience/:expId', protect, updateExperience)
router.delete('/me/experience/:expId', protect, deleteExperience)
router.post('/me/education', protect, addEducation)
router.put('/me/education/:eduId', protect, updateEducation)
router.delete('/me/education/:eduId', protect, deleteEducation)
router.post('/me/skill', protect, addSkill)
router.delete('/me/skill/:skillId', protect, deleteSkill)
router.post('/block', protect, blockUser)
router.delete('/block/:id', protect, unblockUser)
router.post('/report', protect, reportContent)
router.put('/me/username', protect, changeUsername)
router.get('/:id', protect, getUserProfile)

export default router