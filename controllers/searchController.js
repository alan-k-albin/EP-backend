import pool from '../config/db.js'

export const search = async (req, res) => {
  const { q } = req.query
  try {
    // Search users
    const users = await pool.query(
      `SELECT id, full_name, username, profile_photo, is_verified, college
      FROM users
      WHERE full_name ILIKE $1 OR username ILIKE $1
      LIMIT 10`,
      [`%${q}%`]
    )

    // Search posts
    const posts = await pool.query(
      `SELECT p.*, u.full_name, u.username, u.profile_photo, u.is_verified
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.content ILIKE $1
      LIMIT 10`,
      [`%${q}%`]
    )

    // Search hashtags
    const hashtags = await pool.query(
      `SELECT * FROM hashtags
      WHERE name ILIKE $1
      LIMIT 10`,
      [`%${q}%`]
    )

    res.json({
      users: users.rows,
      posts: posts.rows,
      hashtags: hashtags.rows,
    })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}