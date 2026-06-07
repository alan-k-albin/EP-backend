import jwt from 'jsonwebtoken'
import pool from '../config/db.js'

const protect = async (req, res, next) => {
  let token

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1]

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      // Get user from database
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id])
      req.user = result.rows[0]

      next()
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, invalid token' })
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' })
  }
}

export default protect