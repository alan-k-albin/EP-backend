import pool from '../config/db.js'

export const getMyProfile = async (req, res) => {
  const userId = req.user.id
  try {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
    const posts = await pool.query('SELECT COUNT(*) FROM posts WHERE user_id = $1', [userId])
    const connections = await pool.query(
      'SELECT COUNT(*) FROM connections WHERE (sender_id = $1 OR receiver_id = $1) AND status = $2',
      [userId, 'accepted']
    )
    const experience = await pool.query('SELECT * FROM experience WHERE user_id = $1', [userId])
    const education = await pool.query('SELECT * FROM education WHERE user_id = $1', [userId])
    const skills = await pool.query('SELECT * FROM skills WHERE user_id = $1', [userId])

    const u = user.rows[0]
    res.json({
      id: u.id,
      fullName: u.full_name,
      username: u.username,
      email: u.email,
      bio: u.bio,
      college: u.college,
      location: u.location,
      website: u.website,
      profilePhoto: u.profile_photo,
      isVerified: u.is_verified,
      isPrivate: u.is_private,
      postCount: posts.rows[0].count,
      connectionCount: connections.rows[0].count,
      experience: experience.rows,
      education: education.rows,
      skills: skills.rows,
    })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getUserProfile = async (req, res) => {
  const { id } = req.params
  try {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [id])
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }
    const posts = await pool.query('SELECT COUNT(*) FROM posts WHERE user_id = $1', [id])
    const connections = await pool.query(
      'SELECT COUNT(*) FROM connections WHERE (sender_id = $1 OR receiver_id = $1) AND status = $2',
      [id, 'accepted']
    )
    const experience = await pool.query('SELECT * FROM experience WHERE user_id = $1', [id])
    const education = await pool.query('SELECT * FROM education WHERE user_id = $1', [id])
    const skills = await pool.query('SELECT * FROM skills WHERE user_id = $1', [id])

    const u = user.rows[0]
    res.json({
      id: u.id,
      fullName: u.full_name,
      username: u.username,
      bio: u.bio,
      college: u.college,
      location: u.location,
      website: u.website,
      profilePhoto: u.profile_photo,
      isVerified: u.is_verified,
      postCount: posts.rows[0].count,
      connectionCount: connections.rows[0].count,
      experience: experience.rows,
      education: education.rows,
      skills: skills.rows,
    })
  } catch (error) {
    console.error('Get user profile error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const updateProfile = async (req, res) => {
  const userId = req.user.id
  const { fullName, bio, location, website } = req.body
  try {
    const result = await pool.query(
      'UPDATE users SET full_name = $1, bio = $2, location = $3, website = $4 WHERE id = $5 RETURNING *',
      [fullName, bio, location, website, userId]
    )
    res.json(result.rows[0])
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const addExperience = async (req, res) => {
  const userId = req.user.id
  const { title, company, startDate, endDate, current } = req.body
  try {
    const result = await pool.query(
      'INSERT INTO experience (user_id, title, company, start_date, end_date, current) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, title, company, startDate, endDate, current]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Add experience error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const addEducation = async (req, res) => {
  const userId = req.user.id
  const { institution, degree, field, startYear, endYear } = req.body
  try {
    const result = await pool.query(
      'INSERT INTO education (user_id, institution, degree, field, start_year, end_year) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, institution, degree, field, startYear, endYear]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Add education error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const addSkill = async (req, res) => {
  const userId = req.user.id
  const { name } = req.body
  try {
    const result = await pool.query(
      'INSERT INTO skills (user_id, name) VALUES ($1, $2) RETURNING *',
      [userId, name]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Add skill error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const searchUsers = async (req, res) => {
  const { q } = req.query
  try {
    const result = await pool.query(
      `SELECT id, full_name, username, profile_photo, is_verified, college
      FROM users
      WHERE full_name ILIKE $1 OR username ILIKE $1
      LIMIT 20`,
      [`%${q}%`]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Search users error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const blockUser = async (req, res) => {
  const blockerId = req.user.id
  const { blockedId } = req.body
  try {
    await pool.query(
      'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [blockerId, blockedId]
    )
    res.json({ message: 'User blocked' })
  } catch (error) {
    console.error('Block user error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const unblockUser = async (req, res) => {
  const blockerId = req.user.id
  const { id } = req.params
  try {
    await pool.query(
      'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, id]
    )
    res.json({ message: 'User unblocked' })
  } catch (error) {
    console.error('Unblock user error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getBlockedUsers = async (req, res) => {
  const userId = req.user.id
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.profile_photo
      FROM blocks b
      JOIN users u ON b.blocked_id = u.id
      WHERE b.blocker_id = $1`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Get blocked users error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const reportContent = async (req, res) => {
  const reporterId = req.user.id
  const { reportedUserId, reportedPostId, reason } = req.body
  try {
    await pool.query(
      'INSERT INTO reports (reporter_id, reported_user_id, reported_post_id, reason) VALUES ($1, $2, $3, $4)',
      [reporterId, reportedUserId, reportedPostId, reason]
    )
    res.json({ message: 'Report submitted' })
  } catch (error) {
    console.error('Report error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}