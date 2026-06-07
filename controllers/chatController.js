import pool from '../config/db.js'

export const getMyChats = async (req, res) => {
  const userId = req.user.id
  try {
    const result = await pool.query(
      `SELECT c.*, 
      m.content as last_message,
      m.created_at as last_message_time,
      CASE 
        WHEN c.is_group = false THEN u.full_name
        ELSE c.group_name
      END as name,
      CASE 
        WHEN c.is_group = false THEN u.profile_photo
        ELSE null
      END as photo
      FROM chats c
      JOIN chat_members cm ON cm.chat_id = c.id
      LEFT JOIN messages m ON m.id = (
        SELECT id FROM messages 
        WHERE chat_id = c.id 
        ORDER BY created_at DESC LIMIT 1
      )
      LEFT JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id != $1
      LEFT JOIN users u ON u.id = cm2.user_id
      WHERE cm.user_id = $1
      ORDER BY last_message_time DESC`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get chats error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getChatMessages = async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      `SELECT m.*, u.full_name, u.username, u.profile_photo
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = $1
      ORDER BY m.created_at ASC`,
      [id]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get messages error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const createChat = async (req, res) => {
  const { receiverId } = req.body
  const userId = req.user.id
  try {
    const existing = await pool.query(
      `SELECT c.id FROM chats c
      JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = $1
      JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = $2
      WHERE c.is_group = false`,
      [userId, receiverId]
    )
    if (existing.rows.length > 0) {
      return res.json({ chatId: existing.rows[0].id })
    }
    const chat = await pool.query(
      'INSERT INTO chats (is_group) VALUES (false) RETURNING *'
    )
    const chatId = chat.rows[0].id
    await pool.query(
      'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)',
      [chatId, userId, receiverId]
    )
    res.status(201).json({ chatId })
  } catch (error) {
    console.error('Create chat error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const createGroupChat = async (req, res) => {
  const { groupName, memberIds } = req.body
  const userId = req.user.id
  try {
    const chat = await pool.query(
      'INSERT INTO chats (is_group, group_name) VALUES (true, $1) RETURNING *',
      [groupName]
    )
    const chatId = chat.rows[0].id
    const allMembers = [userId, ...memberIds]
    for (const memberId of allMembers) {
      await pool.query(
        'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)',
        [chatId, memberId]
      )
    }
    res.status(201).json({ chatId })
  } catch (error) {
    console.error('Create group chat error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const sendMessage = async (req, res) => {
  const { id } = req.params
  const { content, mediaUrl, mediaType } = req.body
  const userId = req.user.id
  try {
    const result = await pool.query(
      'INSERT INTO messages (chat_id, sender_id, content, media_url, media_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, userId, content, mediaUrl, mediaType]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Send message error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}