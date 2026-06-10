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
    const experience = await pool.query('SELECT * FROM experience WHERE user_id = $1 ORDER BY created_at DESC', [userId])
    const education = await pool.query('SELECT * FROM education WHERE user_id = $1 ORDER BY created_at DESC', [userId])
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
      userType: u.user_type,
      occupation: u.occupation,
      industry: u.industry,
      companySize: u.company_size,
      foundedYear: u.founded_year,
      specialities: u.specialities,
      currentCompany: u.current_company,
      onboardingCompleted: u.onboarding_completed,
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
    const experience = await pool.query('SELECT * FROM experience WHERE user_id = $1 ORDER BY created_at DESC', [id])
    const education = await pool.query('SELECT * FROM education WHERE user_id = $1 ORDER BY created_at DESC', [id])
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
      isPrivate: u.is_private,
      userType: u.user_type,
      occupation: u.occupation,
      industry: u.industry,
      companySize: u.company_size,
      foundedYear: u.founded_year,
      specialities: u.specialities,
      currentCompany: u.current_company,
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
  const { fullName, bio, location, website, occupation, industry, companySize, foundedYear, specialities, currentCompany } = req.body
  try {
    const result = await pool.query(
      `UPDATE users SET 
        full_name = $1, bio = $2, location = $3, website = $4,
        occupation = $5, industry = $6, company_size = $7,
        founded_year = $8, specialities = $9, current_company = $10
      WHERE id = $11 RETURNING *`,
      [fullName, bio, location, website, occupation, industry, companySize, foundedYear, specialities, currentCompany, userId]
    )
    res.json(result.rows[0])
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const updatePrivacy = async (req, res) => {
  const userId = req.user.id
  const { isPrivate, whoCanMessage, whoCanConnect } = req.body
  try {
    await pool.query(
      'UPDATE users SET is_private = $1 WHERE id = $2',
      [isPrivate, userId]
    )
    res.json({ message: 'Privacy settings updated' })
  } catch (error) {
    console.error('Update privacy error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const completeOnboarding = async (req, res) => {
  const userId = req.user.id
  const { userType, onboardingCompleted } = req.body
  try {
    await pool.query(
      'UPDATE users SET user_type = $1, onboarding_completed = $2 WHERE id = $3',
      [userType, onboardingCompleted, userId]
    )
    res.json({ message: 'Onboarding completed' })
  } catch (error) {
    console.error('Onboarding error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const addExperience = async (req, res) => {
  const userId = req.user.id
  const { title, company, startDate, endDate, current, description } = req.body
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

export const updateExperience = async (req, res) => {
  const { expId } = req.params
  const { title, company, startDate, endDate, current } = req.body
  const userId = req.user.id
  try {
    const result = await pool.query(
      'UPDATE experience SET title = $1, company = $2, start_date = $3, end_date = $4, current = $5 WHERE id = $6 AND user_id = $7 RETURNING *',
      [title, company, startDate, endDate, current, expId, userId]
    )
    res.json(result.rows[0])
  } catch (error) {
    console.error('Update experience error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const deleteExperience = async (req, res) => {
  const { expId } = req.params
  const userId = req.user.id
  try {
    await pool.query('DELETE FROM experience WHERE id = $1 AND user_id = $2', [expId, userId])
    res.json({ message: 'Experience deleted' })
  } catch (error) {
    console.error('Delete experience error:', error)
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

export const updateEducation = async (req, res) => {
  const { eduId } = req.params
  const { institution, degree, field, startYear, endYear } = req.body
  const userId = req.user.id
  try {
    const result = await pool.query(
      'UPDATE education SET institution = $1, degree = $2, field = $3, start_year = $4, end_year = $5 WHERE id = $6 AND user_id = $7 RETURNING *',
      [institution, degree, field, startYear, endYear, eduId, userId]
    )
    res.json(result.rows[0])
  } catch (error) {
    console.error('Update education error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const deleteEducation = async (req, res) => {
  const { eduId } = req.params
  const userId = req.user.id
  try {
    await pool.query('DELETE FROM education WHERE id = $1 AND user_id = $2', [eduId, userId])
    res.json({ message: 'Education deleted' })
  } catch (error) {
    console.error('Delete education error:', error)
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

export const deleteSkill = async (req, res) => {
  const { skillId } = req.params
  const userId = req.user.id
  try {
    await pool.query('DELETE FROM skills WHERE id = $1 AND user_id = $2', [skillId, userId])
    res.json({ message: 'Skill deleted' })
  } catch (error) {
    console.error('Delete skill error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const searchUsers = async (req, res) => {
  const { q } = req.query
  try {
    const result = await pool.query(
      `SELECT id, full_name, username, profile_photo, is_verified, college, user_type
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