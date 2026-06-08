import pool from '../config/db.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' })
}

// Register
export const register = async (req, res) => {
  const { fullName, username, email, college, password, userType } = req.body

  try {
    // Check if email already exists
    const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email already in use' })
    }

    // Check if username already exists
    const usernameCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username])
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Username already taken' })
    }

    // Encrypt password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Save user to database
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

// Login
export const login = async (req, res) => {
  const { email, password } = req.body

  try {
    // Check if user exists
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' })
    }

    const user = result.rows[0]

    // Check password
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

// Get current user
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
    })

  } catch (error) {
    console.error('GetMe error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}