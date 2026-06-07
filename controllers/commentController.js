import pool from '../config/db.js'

export const addComment = async (req, res) => {
  const { id } = req.params
  const { content } = req.body
  const userId = req.user.id
  try {
    const result = await pool.query(
      'INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [id, userId, content]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Add comment error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getComments = async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      `SELECT c.*, u.full_name, u.username, u.profile_photo, u.is_verified,
      COUNT(DISTINCT r.id) as reply_count
      FROM comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN replies r ON r.comment_id = c.id
      WHERE c.post_id = $1
      GROUP BY c.id, u.full_name, u.username, u.profile_photo, u.is_verified
      ORDER BY c.created_at ASC`,
      [id]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get comments error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const deleteComment = async (req, res) => {
  const { commentId } = req.params
  const userId = req.user.id
  try {
    const comment = await pool.query('SELECT * FROM comments WHERE id = $1', [commentId])
    if (comment.rows[0].user_id !== userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }
    await pool.query('DELETE FROM comments WHERE id = $1', [commentId])
    res.json({ message: 'Comment deleted' })
  } catch (error) {
    console.error('Delete comment error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const addReply = async (req, res) => {
  const { commentId } = req.params
  const { content } = req.body
  const userId = req.user.id
  try {
    const result = await pool.query(
      'INSERT INTO replies (comment_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [commentId, userId, content]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Add reply error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getReplies = async (req, res) => {
  const { commentId } = req.params
  try {
    const result = await pool.query(
      `SELECT r.*, u.full_name, u.username, u.profile_photo, u.is_verified
      FROM replies r
      JOIN users u ON r.user_id = u.id
      WHERE r.comment_id = $1
      ORDER BY r.created_at ASC`,
      [commentId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get replies error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}