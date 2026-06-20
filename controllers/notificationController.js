import pool from '../config/db.js'

export const getNotifications = async (req, res) => {
  const userId = req.user.id
  try {
    const result = await pool.query(
      `SELECT n.*, 
        u.full_name as sender_name, 
        u.profile_photo as sender_photo,
        u.username as sender_username
       FROM notifications n
       LEFT JOIN users u ON n.sender_id = u.id
       WHERE n.user_id = $1 
       ORDER BY n.created_at DESC`,
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

export const createNotification = async (userId, type, message, senderId = null, relatedId = null) => {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, type, message, sender_id, related_id) VALUES ($1, $2, $3, $4, $5)',
      [userId, type, message, senderId, relatedId]
    )
  } catch (error) {
    console.error('Create notification error:', error)
  }
}