import jwt from 'jsonwebtoken'
import pool from '../config/db.js'

const protect = async (req, res, next) => {
  let token

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1]

      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      const result = await pool.query(
        'SELECT id, full_name, username, email, user_type, is_admin, is_banned, profile_photo, is_verified, onboarding_completed FROM users WHERE id = $1',
        [decoded.id]
      )

      if (result.rows.length === 0) {
        return res.status(401).json({ message: 'Not authorized, user not found' })
      }

      const user = result.rows[0]

      // Block banned users immediately even with valid token
      if (user.is_banned) {
        return res.status(403).json({ message: 'Your account has been banned. Please contact support.' })
      }

      req.user = user
      next()
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Session expired. Please log in again.' })
      }
      return res.status(401).json({ message: 'Not authorized, invalid token' })
    }
  } else if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' })
  }
}

export default protect