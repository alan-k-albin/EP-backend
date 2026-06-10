import pool from '../config/db.js'
import { createNotification } from './notificationController.js'

export const createPost = async (req, res) => {
  const { content, mediaUrl, mediaType } = req.body
  const userId = req.user.id
  try {
    const result = await pool.query(
      'INSERT INTO posts (user_id, content, media_url, media_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, content, mediaUrl, mediaType]
    )

    // Extract and save hashtags
    const hashtags = content.match(/#\w+/g)
    if (hashtags) {
      for (const tag of hashtags) {
        const tagName = tag.slice(1).toLowerCase()
        const existing = await pool.query('SELECT id FROM hashtags WHERE name = $1', [tagName])
        let hashtagId
        if (existing.rows.length > 0) {
          hashtagId = existing.rows[0].id
        } else {
          const newTag = await pool.query('INSERT INTO hashtags (name) VALUES ($1) RETURNING id', [tagName])
          hashtagId = newTag.rows[0].id
        }
        await pool.query(
          'INSERT INTO post_hashtags (post_id, hashtag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [result.rows[0].id, hashtagId]
        )
      }
    }

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Create post error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getFeedPosts = async (req, res) => {
  const userId = req.user.id
  try {
    const result = await pool.query(
      `SELECT p.*, u.full_name, u.username, u.profile_photo, u.is_verified,
      COUNT(DISTINCT r.id) as reaction_count,
      COUNT(DISTINCT c.id) as comment_count,
      COUNT(DISTINCT a.id) as attempted_count,
      EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = $1) as bookmarked,
      EXISTS(SELECT 1 FROM reactions r2 WHERE r2.post_id = p.id AND r2.user_id = $1) as liked,
      EXISTS(SELECT 1 FROM attempted a2 WHERE a2.post_id = p.id AND a2.user_id = $1) as attempted
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN reactions r ON r.post_id = p.id
      LEFT JOIN comments c ON c.post_id = p.id
      LEFT JOIN attempted a ON a.post_id = p.id
      WHERE p.user_id IN (
        SELECT CASE
          WHEN sender_id = $1 THEN receiver_id
          WHEN receiver_id = $1 THEN sender_id
        END
        FROM connections
        WHERE (sender_id = $1 OR receiver_id = $1)
        AND status = 'accepted'
      ) OR p.user_id = $1
      GROUP BY p.id, u.full_name, u.username, u.profile_photo, u.is_verified
      ORDER BY p.created_at DESC`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get feed error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getPost = async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      `SELECT p.*, u.full_name, u.username, u.profile_photo, u.is_verified
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' })
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('Get post error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const updatePost = async (req, res) => {
  const { id } = req.params
  const { content } = req.body
  const userId = req.user.id
  try {
    const post = await pool.query('SELECT * FROM posts WHERE id = $1', [id])
    if (post.rows[0].user_id !== userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }
    const result = await pool.query(
      'UPDATE posts SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [content, id]
    )
    res.json(result.rows[0])
  } catch (error) {
    console.error('Update post error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const deletePost = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    const post = await pool.query('SELECT * FROM posts WHERE id = $1', [id])
    if (post.rows[0].user_id !== userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }
    await pool.query('DELETE FROM posts WHERE id = $1', [id])
    res.json({ message: 'Post deleted successfully' })
  } catch (error) {
    console.error('Delete post error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const reactToPost = async (req, res) => {
  const { id } = req.params
  const { type } = req.body
  const userId = req.user.id
  try {
    const existing = await pool.query(
      'SELECT * FROM reactions WHERE post_id = $1 AND user_id = $2',
      [id, userId]
    )
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM reactions WHERE post_id = $1 AND user_id = $2', [id, userId])
      return res.json({ message: 'Reaction removed' })
    }
    await pool.query(
      'INSERT INTO reactions (post_id, user_id, type) VALUES ($1, $2, $3)',
      [id, userId, type]
    )
    const post = await pool.query('SELECT * FROM posts WHERE id = $1', [id])
    if (post.rows[0].user_id !== userId) {
      const reactor = await pool.query('SELECT full_name FROM users WHERE id = $1', [userId])
      await createNotification(post.rows[0].user_id, 'like', `${reactor.rows[0].full_name} liked your post`)
    }
    res.json({ message: 'Reaction added' })
  } catch (error) {
    console.error('React error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getPostsByUser = async (req, res) => {
  const { userId } = req.params
  try {
    const result = await pool.query(
      `SELECT p.*, u.full_name, u.username, u.profile_photo, u.is_verified
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get user posts error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const attemptPost = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    const existing = await pool.query(
      'SELECT * FROM attempted WHERE post_id = $1 AND user_id = $2',
      [id, userId]
    )
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM attempted WHERE post_id = $1 AND user_id = $2', [id, userId])
      return res.json({ message: 'Attempt removed' })
    }
    await pool.query('INSERT INTO attempted (post_id, user_id) VALUES ($1, $2)', [id, userId])
    const post = await pool.query('SELECT * FROM posts WHERE id = $1', [id])
    if (post.rows[0].user_id !== userId) {
      const attemptor = await pool.query('SELECT full_name FROM users WHERE id = $1', [userId])
      await createNotification(post.rows[0].user_id, 'attempted', `${attemptor.rows[0].full_name} attempted your post`)
    }
    res.json({ message: 'Attempted!' })
  } catch (error) {
    console.error('Attempt error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getAttempted = async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      `SELECT a.*, u.full_name, u.username, u.profile_photo, u.is_verified
      FROM attempted a
      JOIN users u ON a.user_id = u.id
      WHERE a.post_id = $1`,
      [id]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get attempted error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const bookmarkPost = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    const existing = await pool.query(
      'SELECT * FROM bookmarks WHERE post_id = $1 AND user_id = $2',
      [id, userId]
    )
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM bookmarks WHERE post_id = $1 AND user_id = $2', [id, userId])
      return res.json({ message: 'Bookmark removed', bookmarked: false })
    }
    await pool.query('INSERT INTO bookmarks (post_id, user_id) VALUES ($1, $2)', [id, userId])
    res.json({ message: 'Bookmarked!', bookmarked: true })
  } catch (error) {
    console.error('Bookmark error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getBookmarks = async (req, res) => {
  const userId = req.user.id
  try {
    const result = await pool.query(
      `SELECT p.*, u.full_name, u.username, u.profile_photo, u.is_verified,
      COUNT(DISTINCT r.id) as reaction_count,
      COUNT(DISTINCT c.id) as comment_count,
      COUNT(DISTINCT a.id) as attempted_count
      FROM bookmarks b
      JOIN posts p ON b.post_id = p.id
      JOIN users u ON p.user_id = u.id
      LEFT JOIN reactions r ON r.post_id = p.id
      LEFT JOIN comments c ON c.post_id = p.id
      LEFT JOIN attempted a ON a.post_id = p.id
      WHERE b.user_id = $1
      GROUP BY p.id, u.full_name, u.username, u.profile_photo, u.is_verified
      ORDER BY b.created_at DESC`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get bookmarks error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const repostPost = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    const original = await pool.query('SELECT * FROM posts WHERE id = $1', [id])
    if (original.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' })
    }
    const content = `🔁 Reposted: ${original.rows[0].content}`
    const result = await pool.query(
      'INSERT INTO posts (user_id, content, media_url, media_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, content, original.rows[0].media_url, original.rows[0].media_type]
    )
    if (original.rows[0].user_id !== userId) {
      const reposter = await pool.query('SELECT full_name FROM users WHERE id = $1', [userId])
      await createNotification(original.rows[0].user_id, 'repost', `${reposter.rows[0].full_name} reposted your post`)
    }
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Repost error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getPostsByHashtag = async (req, res) => {
  const { tag } = req.params
  try {
    const result = await pool.query(
      `SELECT p.*, u.full_name, u.username, u.profile_photo, u.is_verified,
      COUNT(DISTINCT r.id) as reaction_count,
      COUNT(DISTINCT c.id) as comment_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      JOIN post_hashtags ph ON ph.post_id = p.id
      JOIN hashtags h ON h.id = ph.hashtag_id
      LEFT JOIN reactions r ON r.post_id = p.id
      LEFT JOIN comments c ON c.post_id = p.id
      WHERE h.name = $1
      GROUP BY p.id, u.full_name, u.username, u.profile_photo, u.is_verified
      ORDER BY p.created_at DESC`,
      [tag.toLowerCase()]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get posts by hashtag error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}