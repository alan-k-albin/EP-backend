import pool from '../config/db.js'

const adminOnly = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id])
    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ message: 'Access denied. Admins only.' })
    }
    next()
  } catch (error) {
    console.error('Admin middleware error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export default adminOnly