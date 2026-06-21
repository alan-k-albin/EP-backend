import express from 'express'
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  changeEmail,
  deleteAccount,
  verifyStudent,
  googleLogin,
} from '../controllers/authController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.post('/google', googleLogin)
router.get('/me', protect, getMe)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.put('/change-password', protect, changePassword)
router.put('/change-email', protect, changeEmail)
router.delete('/delete-account', protect, deleteAccount)
router.post('/verify-student', protect, verifyStudent)

export default router