import express from 'express'
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  changeEmail,
  deleteAccount
} from '../controllers/authController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', protect, getMe)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.put('/change-password', protect, changePassword)
router.put('/change-email', protect, changeEmail)
router.delete('/delete-account', protect, deleteAccount)
router.post('/verify-student', protect, async (req, res) => {
  const { method, institutionalEmail, college, idNumber, idPhoto } = req.body
  const userId = req.user.id
  try {
    const pool = (await import('../config/db.js')).default
    await pool.query(
      'INSERT INTO verifications (user_id, college, id_number, id_photo, status) VALUES ($1, $2, $3, $4, $5)',
      [userId, college || institutionalEmail, idNumber || institutionalEmail, idPhoto || null, 'pending']
    )
    if (method === 'email') {
      const domain = institutionalEmail?.split('@')[1]
      const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']
      if (!personalDomains.includes(domain)) {
        await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [userId])
      }
    }
    res.json({ message: 'Verification submitted' })
  } catch (error) {
    console.error('Verify student error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router