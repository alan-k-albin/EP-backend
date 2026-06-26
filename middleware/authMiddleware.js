import jwt from 'jsonwebtoken'
import pool from '../config/db.js'

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' })
  }

  const token = authHeader.split(' ')[1]

  // Structural sanity check before hitting the crypto layer
  if (!token || token.length < 20 || token.split('.').length !== 3) {
    return res.status(401).json({ message: 'Not authorized, malformed token' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],  // Explicitly whitelist algorithm — prevents alg:none attack
    })

    if (!decoded.id || !decoded.jti) {
      return res.status(401).json({ message: 'Not authorized, invalid token structure' })
    }

    const result = await pool.query(
      `SELECT id, full_name, username, email, user_type, is_admin,
              is_banned, profile_photo, is_verified, onboarding_completed
       FROM users WHERE id = $1`,
      [decoded.id]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Not authorized, user not found' })
    }

    const user = result.rows[0]

    if (user.is_banned) {
      return res.status(403).json({ message: 'Your account has been banned. Please contact support.' })
    }

    req.user = user
    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' })
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Not authorized, invalid token' })
    }
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({ message: 'Token not yet valid' })
    }
    return res.status(401).json({ message: 'Not authorized' })
  }
}

export default protect