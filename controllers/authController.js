import pool from '../config/db.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' })
}

export const register = async (req, res) => {
  const { fullName, username, email, college, password, userType } = req.body
  try {
    const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email already in use' })
    }
    const usernameCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username])
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Username already taken' })
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    const result = await pool.query(
      'INSERT INTO users (full_name, username, email, college, password, user_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [fullName, username, email, college, hashedPassword, userType || 'public']
    )
    const user = result.rows[0]
    res.status(201).json({
      message: 'Account created successfully!',
      token: generateToken(user.id),
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
        college: user.college,
      }
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const login = async (req, res) => {
  const { email, password } = req.body
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' })
    }
    const user = result.rows[0]
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' })
    }
    res.json({
      message: 'Login successful!',
      token: generateToken(user.id),
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
        college: user.college,
        profilePhoto: user.profile_photo,
        isVerified: user.is_verified,
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getMe = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id])
    const user = result.rows[0]
    res.json({
      id: user.id,
      fullName: user.full_name,
      username: user.username,
      email: user.email,
      college: user.college,
      bio: user.bio,
      location: user.location,
      website: user.website,
      profilePhoto: user.profile_photo,
      isVerified: user.is_verified,
      isPrivate: user.is_private,
      userType: user.user_type,
      onboardingCompleted: user.onboarding_completed,
    })
  } catch (error) {
    console.error('GetMe error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const forgotPassword = async (req, res) => {
  const { email } = req.body
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'No account found with this email' })
    }
    const user = result.rows[0]
    const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' })
    res.json({
      message: 'Password reset link sent!',
      resetToken,
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, decoded.id])
    res.json({ message: 'Password reset successfully!' })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({ message: 'Invalid or expired token' })
  }
}

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const userId = req.user.id
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
    const user = result.rows[0]
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' })
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId])
    res.json({ message: 'Password changed successfully!' })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const changeEmail = async (req, res) => {
  const { email } = req.body
  const userId = req.user.id
  try {
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email already in use' })
    }
    await pool.query('UPDATE users SET email = $1 WHERE id = $2', [email, userId])
    res.json({ message: 'Email updated successfully!' })
  } catch (error) {
    console.error('Change email error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const deleteAccount = async (req, res) => {
  const userId = req.user.id
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [userId])
    res.json({ message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Delete account error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}