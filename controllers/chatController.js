import pool from '../config/db.js'

export const getMyChats = async (req, res) => {
  const userId = req.user.id
  try {
    const result = await pool.query(
      `SELECT DISTINCT c.*,
      CASE 
        WHEN c.is_group = false THEN (
          SELECT u.full_name FROM users u
          JOIN chat_members cm2 ON cm2.user_id = u.id
          WHERE cm2.chat_id = c.id AND cm2.user_id != $1
          LIMIT 1
        )
        ELSE c.group_name
      END as name,
      CASE 
        WHEN c.is_group = false THEN (
          SELECT u.profile_photo FROM users u
          JOIN chat_members cm2 ON cm2.user_id = u.id
          WHERE cm2.chat_id = c.id AND cm2.user_id != $1
          LIMIT 1
        )
        ELSE null
      END as photo,
      (
        SELECT m.content FROM messages m
        WHERE m.chat_id = c.id
        ORDER BY m.created_at DESC LIMIT 1
      ) as last_message,
      (
        SELECT m.created_at FROM messages m
        WHERE m.chat_id = c.id
        ORDER BY m.created_at DESC LIMIT 1
      ) as last_message_time,
      (
        SELECT COUNT(*) FROM messages m
        WHERE m.chat_id = c.id
        AND m.sender_id != $1
        AND m.created_at > COALESCE(
          (SELECT last_read_at FROM chat_members WHERE chat_id = c.id AND user_id = $1),
          '1970-01-01'
        )
      ) as unread_count
      FROM chats c
      JOIN chat_members cm ON cm.chat_id = c.id
      WHERE cm.user_id = $1
      ORDER BY last_message_time DESC NULLS LAST`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get chats error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getUnreadChatCount = async (req, res) => {
  const userId = req.user.id
  try {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT c.id) as unread_chats
      FROM chats c
      JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $1
      WHERE (
        SELECT COUNT(*) FROM messages m
        WHERE m.chat_id = c.id
        AND m.sender_id != $1
        AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')
      ) > 0`,
      [userId]
    )
    res.json({ count: result.rows[0].unread_chats })
  } catch (error) {
    console.error('Get unread chat count error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const markChatAsRead = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    await pool.query(
      'UPDATE chat_members SET last_read_at = NOW() WHERE chat_id = $1 AND user_id = $2',
      [id, userId]
    )
    res.json({ message: 'Chat marked as read' })
  } catch (error) {
    console.error('Mark chat as read error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getChatMessages = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    const memberCheck = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [id, userId]
    )
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' })
    }
    // Mark as read when messages are fetched
    await pool.query(
      'UPDATE chat_members SET last_read_at = NOW() WHERE chat_id = $1 AND user_id = $2',
      [id, userId]
    )
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
    if (userId === receiverId) {
      return res.status(400).json({ message: 'Cannot chat with yourself' })
    }
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
    if (!groupName || !memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: 'Group name and members are required' })
    }
    const chat = await pool.query(
      'INSERT INTO chats (is_group, group_name) VALUES (true, $1) RETURNING *',
      [groupName]
    )
    const chatId = chat.rows[0].id
    const allMembers = [userId, ...memberIds]
    for (const memberId of allMembers) {
      await pool.query(
        'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [chatId, memberId]
      )
    }
    res.status(201).json({ chatId, chat: chat.rows[0] })
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
    const memberCheck = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [id, userId]
    )
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' })
    }
    const result = await pool.query(
      `INSERT INTO messages (chat_id, sender_id, content, media_url, media_type) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, userId, content || null, mediaUrl || null, mediaType || null]
    )
    const messageWithUser = await pool.query(
      `SELECT m.*, u.full_name, u.username, u.profile_photo
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = $1`,
      [result.rows[0].id]
    )
    res.status(201).json(messageWithUser.rows[0])
  } catch (error) {
    console.error('Send message error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getChatInfo = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    const chat = await pool.query('SELECT * FROM chats WHERE id = $1', [id])
    if (chat.rows.length === 0) {
      return res.status(404).json({ message: 'Chat not found' })
    }
    const members = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.profile_photo, u.is_verified
      FROM chat_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.chat_id = $1`,
      [id]
    )
    const otherMember = members.rows.find((m) => m.id !== userId)
    res.json({
      ...chat.rows[0],
      members: members.rows,
      otherMember,
    })
  } catch (error) {
    console.error('Get chat info error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}