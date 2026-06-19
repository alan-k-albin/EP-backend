import pool from '../config/db.js'

// ─── DASHBOARD STATS ───────────────────────────────────────────────────────────
export const getStats = async (req, res) => {
  try {
    const totalUsers = await pool.query('SELECT COUNT(*) FROM users')
    const totalPosts = await pool.query('SELECT COUNT(*) FROM posts')
    const totalConnections = await pool.query("SELECT COUNT(*) FROM connections WHERE status = 'accepted'")
    const totalReports = await pool.query('SELECT COUNT(*) FROM reports')
    const pendingVerifications = await pool.query("SELECT COUNT(*) FROM verifications WHERE status = 'pending'")
    const newUsersThisWeek = await pool.query(
      "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"
    )
    const newPostsThisWeek = await pool.query(
      "SELECT COUNT(*) FROM posts WHERE created_at >= NOW() - INTERVAL '7 days'"
    )
    const usersByType = await pool.query(
      "SELECT user_type, COUNT(*) as count FROM users GROUP BY user_type"
    )

    res.json({
      totalUsers: totalUsers.rows[0].count,
      totalPosts: totalPosts.rows[0].count,
      totalConnections: totalConnections.rows[0].count,
      totalReports: totalReports.rows[0].count,
      pendingVerifications: pendingVerifications.rows[0].count,
      newUsersThisWeek: newUsersThisWeek.rows[0].count,
      newPostsThisWeek: newPostsThisWeek.rows[0].count,
      usersByType: usersByType.rows,
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ─── USER MANAGEMENT ───────────────────────────────────────────────────────────
export const getAllUsers = async (req, res) => {
  const { search, type, page = 1 } = req.query
  const limit = 20
  const offset = (page - 1) * limit
  try {
    let query = `
      SELECT id, full_name, username, email, user_type, is_verified, is_banned, is_admin,
             profile_photo, created_at, college
      FROM users WHERE 1=1`
    const params = []

    if (search) {
      params.push(`%${search}%`)
      query += ` AND (full_name ILIKE $${params.length} OR username ILIKE $${params.length} OR email ILIKE $${params.length})`
    }
    if (type && type !== 'all') {
      params.push(type)
      query += ` AND user_type = $${params.length}`
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`

    const result = await pool.query(query, params)

    const countQuery = `SELECT COUNT(*) FROM users WHERE 1=1${search ? ` AND (full_name ILIKE '%${search}%' OR username ILIKE '%${search}%' OR email ILIKE '%${search}%')` : ''}${type && type !== 'all' ? ` AND user_type = '${type}'` : ''}`
    const countResult = await pool.query(countQuery)

    res.json({
      users: result.rows,
      total: countResult.rows[0].count,
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit),
    })
  } catch (error) {
    console.error('Get all users error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const deleteUser = async (req, res) => {
  const { userId } = req.params
  try {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
    if (user.rows.length === 0) return res.status(404).json({ message: 'User not found' })
    if (user.rows[0].is_admin) return res.status(403).json({ message: 'Cannot delete admin user' })
    await pool.query('DELETE FROM users WHERE id = $1', [userId])
    res.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const banUser = async (req, res) => {
  const { userId } = req.params
  try {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
    if (user.rows.length === 0) return res.status(404).json({ message: 'User not found' })
    if (user.rows[0].is_admin) return res.status(403).json({ message: 'Cannot ban admin user' })
    const newBanStatus = !user.rows[0].is_banned
    await pool.query('UPDATE users SET is_banned = $1 WHERE id = $2', [newBanStatus, userId])
    res.json({ message: newBanStatus ? 'User banned' : 'User unbanned', is_banned: newBanStatus })
  } catch (error) {
    console.error('Ban user error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const promoteUser = async (req, res) => {
  const { userId } = req.params
  try {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
    if (user.rows.length === 0) return res.status(404).json({ message: 'User not found' })
    const newAdminStatus = !user.rows[0].is_admin
    await pool.query('UPDATE users SET is_admin = $1 WHERE id = $2', [newAdminStatus, userId])
    res.json({ message: newAdminStatus ? 'User promoted to admin' : 'Admin rights removed', is_admin: newAdminStatus })
  } catch (error) {
    console.error('Promote user error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ─── POST MANAGEMENT ───────────────────────────────────────────────────────────
export const getAllPosts = async (req, res) => {
  const { search, page = 1 } = req.query
  const limit = 20
  const offset = (page - 1) * limit
  try {
    let query = `
      SELECT p.id, p.content, p.media_url, p.media_type, p.created_at,
             u.full_name, u.username, u.profile_photo,
             COUNT(DISTINCT r.id) as reaction_count,
             COUNT(DISTINCT c.id) as comment_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN reactions r ON r.post_id = p.id
      LEFT JOIN comments c ON c.post_id = p.id
      WHERE 1=1`
    const params = []

    if (search) {
      params.push(`%${search}%`)
      query += ` AND (p.content ILIKE $${params.length} OR u.username ILIKE $${params.length})`
    }

    query += ` GROUP BY p.id, u.full_name, u.username, u.profile_photo ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}`

    const result = await pool.query(query, params)
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM posts p JOIN users u ON p.user_id = u.id WHERE 1=1${search ? ` AND (p.content ILIKE '%${search}%' OR u.username ILIKE '%${search}%')` : ''}`
    )

    res.json({
      posts: result.rows,
      total: countResult.rows[0].count,
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit),
    })
  } catch (error) {
    console.error('Get all posts error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const adminDeletePost = async (req, res) => {
  const { postId } = req.params
  try {
    await pool.query('DELETE FROM posts WHERE id = $1', [postId])
    res.json({ message: 'Post deleted successfully' })
  } catch (error) {
    console.error('Admin delete post error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ─── STUDENT VERIFICATIONS ─────────────────────────────────────────────────────
export const getPendingVerifications = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, u.full_name, u.username, u.email, u.profile_photo
       FROM verifications v
       JOIN users u ON v.user_id = u.id
       WHERE v.status = 'pending'
       ORDER BY v.created_at ASC`
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get verifications error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const approveVerification = async (req, res) => {
  const { verificationId } = req.params
  try {
    const verification = await pool.query('SELECT * FROM verifications WHERE id = $1', [verificationId])
    if (verification.rows.length === 0) return res.status(404).json({ message: 'Verification not found' })
    await pool.query("UPDATE verifications SET status = 'approved' WHERE id = $1", [verificationId])
    await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [verification.rows[0].user_id])
    res.json({ message: 'Verification approved' })
  } catch (error) {
    console.error('Approve verification error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const rejectVerification = async (req, res) => {
  const { verificationId } = req.params
  try {
    await pool.query("UPDATE verifications SET status = 'rejected' WHERE id = $1", [verificationId])
    res.json({ message: 'Verification rejected' })
  } catch (error) {
    console.error('Reject verification error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ─── REPORTS ───────────────────────────────────────────────────────────────────
export const getAllReports = async (req, res) => {
  const { status = 'pending' } = req.query
  try {
    const result = await pool.query(
      `SELECT r.*,
        reporter.full_name as reporter_name, reporter.username as reporter_username,
        reported_user.full_name as reported_user_name, reported_user.username as reported_user_username,
        p.content as post_content
       FROM reports r
       JOIN users reporter ON r.reporter_id = reporter.id
       LEFT JOIN users reported_user ON r.reported_user_id = reported_user.id
       LEFT JOIN posts p ON r.reported_post_id = p.id
       WHERE r.status = $1
       ORDER BY r.created_at DESC`,
      [status]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get reports error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const resolveReport = async (req, res) => {
  const { reportId } = req.params
  const { action } = req.body // 'dismiss' | 'delete_post' | 'ban_user'
  try {
    const report = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId])
    if (report.rows.length === 0) return res.status(404).json({ message: 'Report not found' })
    const r = report.rows[0]

    if (action === 'delete_post' && r.reported_post_id) {
      await pool.query('DELETE FROM posts WHERE id = $1', [r.reported_post_id])
    }
    if (action === 'ban_user' && r.reported_user_id) {
      await pool.query('UPDATE users SET is_banned = TRUE WHERE id = $1', [r.reported_user_id])
    }

    await pool.query("UPDATE reports SET status = 'resolved' WHERE id = $1", [reportId])
    res.json({ message: 'Report resolved' })
  } catch (error) {
    console.error('Resolve report error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}