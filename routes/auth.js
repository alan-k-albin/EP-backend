import express from 'express'
import {
  register,
  login,
  googleLogin,
  refreshToken,
  logout,
  logoutAll,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  changeEmail,
  deleteAccount,
  verifyStudent,
} from '../controllers/authController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.post('/google', googleLogin)
router.post('/refresh', refreshToken)
router.post('/logout', logout)
router.post('/logout-all', protect, logoutAll)
router.get('/me', protect, getMe)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.put('/change-password', protect, changePassword)
router.put('/change-email', protect, changeEmail)
router.delete('/delete-account', protect, deleteAccount)
router.post('/verify-student', protect, verifyStudent)

export default router