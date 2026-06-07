import pool from '../config/db.js'

export const sendRequest = async (req, res) => {
  const { receiverId } = req.body
  const senderId = req.user.id
  try {
    if (senderId === receiverId) {
      return res.status(400).json({ message: 'Cannot connect with yourself' })
    }
    const existing = await pool.query(
      'SELECT * FROM connections WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)',
      [senderId, receiverId]
    )
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Connection already exists' })
    }
    const result = await pool.query(
      'INSERT INTO connections (sender_id, receiver_id, status) VALUES ($1, $2, $3) RETURNING *',
      [senderId, receiverId, 'pending']
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Send request error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const acceptRequest = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    const connection = await pool.query('SELECT * FROM connections WHERE id = $1', [id])
    if (connection.rows[0].receiver_id !== userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }
    const result = await pool.query(
      'UPDATE connections SET status = $1 WHERE id = $2 RETURNING *',
      ['accepted', id]
    )
    res.json(result.rows[0])
  } catch (error) {
    console.error('Accept request error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const declineRequest = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    const connection = await pool.query('SELECT * FROM connections WHERE id = $1', [id])
    if (connection.rows[0].receiver_id !== userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }
    await pool.query('DELETE FROM connections WHERE id = $1', [id])
    res.json({ message: 'Request declined' })
  } catch (error) {
    console.error('Decline request error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const removeConnection = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    await pool.query(
      'DELETE FROM connections WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)',
      [id, userId]
    )
    res.json({ message: 'Connection removed' })
  } catch (error) {
    console.error('Remove connection error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getMyConnections = async (req, res) => {
  const userId = req.user.id
  try {
    const result = await pool.query(
      `SELECT c.*, 
      CASE WHEN c.sender_id = $1 THEN u2.full_name ELSE u1.full_name END as full_name,
      CASE WHEN c.sender_id = $1 THEN u2.username ELSE u1.username END as username,
      CASE WHEN c.sender_id = $1 THEN u2.profile_photo ELSE u1.profile_photo END as profile_photo,
      CASE WHEN c.sender_id = $1 THEN u2.is_verified ELSE u1.is_verified END as is_verified,
      CASE WHEN c.sender_id = $1 THEN u2.id ELSE u1.id END as connected_user_id
      FROM connections c
      JOIN users u1 ON c.sender_id = u1.id
      JOIN users u2 ON c.receiver_id = u2.id
      WHERE (c.sender_id = $1 OR c.receiver_id = $1)
      AND c.status = 'accepted'`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get connections error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getPendingRequests = async (req, res) => {
  const userId = req.user.id
  try {
    const result = await pool.query(
      `SELECT c.*, u.full_name, u.username, u.profile_photo, u.is_verified
      FROM connections c
      JOIN users u ON c.sender_id = u.id
      WHERE c.receiver_id = $1 AND c.status = 'pending'`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get pending requests error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}