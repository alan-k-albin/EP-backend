import pool from '../config/db.js'

export const getNotifications = async (req, res) => {
  const userId = req.user.id
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const markAsRead = async (req, res) => {
  const userId = req.user.id
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [userId]
    )
    res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    console.error('Mark as read error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getUnreadCount = async (req, res) => {
  const userId = req.user.id
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    )
    res.json({ count: result.rows[0].count })
  } catch (error) {
    console.error('Get unread count error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const createNotification = async (userId, type, message, pool) => {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)',
      [userId, type, message]
    )
  } catch (error) {
    console.error('Create notification error:', error)
  }
}