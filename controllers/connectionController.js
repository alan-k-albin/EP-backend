import pool from '../config/db.js'
import { createNotification } from './notificationController.js'

export const sendRequest = async (req, res) => {
  const { receiverId } = req.body
  const senderId = req.user.id
  try {
    if (senderId === receiverId) {
      return res.status(400).json({ message: 'You cannot connect with yourself' })
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
    const sender = await pool.query('SELECT full_name FROM users WHERE id = $1', [senderId])
    await createNotification(
      receiverId,
      'connection_request',
      `${sender.rows[0].full_name} sent you a connection request`,
      senderId,
      senderId
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
    if (!connection.rows[0] || connection.rows[0].receiver_id !== userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }
    const result = await pool.query(
      'UPDATE connections SET status = $1 WHERE id = $2 RETURNING *',
      ['accepted', id]
    )
    const acceptor = await pool.query('SELECT full_name FROM users WHERE id = $1', [userId])
    await createNotification(
      connection.rows[0].sender_id,
      'connection_accepted',
      `${acceptor.rows[0].full_name} accepted your connection request`,
      userId,
      userId
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
    if (!connection.rows[0] || connection.rows[0].receiver_id !== userId) {
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
      `SELECT c.*, u.full_name, u.username, u.profile_photo, u.is_verified, u.college, u.user_type
      FROM connections c
      JOIN users u ON c.sender_id = u.id
      WHERE c.receiver_id = $1 AND c.status = 'pending'
      ORDER BY c.created_at DESC`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get pending requests error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getConnectionStatus = async (req, res) => {
  const { userId } = req.params
  const myId = req.user.id
  try {
    const result = await pool.query(
      `SELECT * FROM connections 
      WHERE (sender_id = $1 AND receiver_id = $2) 
      OR (sender_id = $2 AND receiver_id = $1)`,
      [myId, userId]
    )
    if (result.rows.length === 0) {
      return res.json({ status: 'none' })
    }
    const conn = result.rows[0]
    if (conn.status === 'accepted') {
      return res.json({ status: 'connected', connectionId: conn.id })
    }
    if (conn.status === 'pending' && conn.sender_id === myId) {
      return res.json({ status: 'pending_sent', connectionId: conn.id })
    }
    if (conn.status === 'pending' && conn.receiver_id === myId) {
      return res.json({ status: 'pending_received', connectionId: conn.id })
    }
    res.json({ status: 'none' })
  } catch (error) {
    console.error('Get connection status error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}