import pool from '../config/db.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

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
      `INSERT INTO users 
      (full_name, username, email, college, password, user_type, onboarding_completed) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [fullName, username, email, college, hashedPassword, userType || null, false]
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
        userType: user.user_type,
        onboardingCompleted: user.onboarding_completed,
        profilePhoto: user.profile_photo,
        isVerified: user.is_verified,
        isAdmin: user.is_admin,
        isBanned: user.is_banned,
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

    if (!user.password) {
      return res.status(400).json({ message: 'This account uses Google Sign In. Please use the Google button to log in.' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' })
    }
    if (user.is_banned) {
      return res.status(403).json({ message: 'Your account has been banned. Please contact support.' })
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
        userType: user.user_type,
        onboardingCompleted: user.onboarding_completed,
        isAdmin: user.is_admin,
        isBanned: user.is_banned,
      }
    })
  } catch (error) {
  console.error('Google login error:', error)
  console.error('Message:', error.message)

  res.status(500).json({
    message: error.message
  })
}
}

export const googleLogin = async (req, res) => {
  const { token } = req.body
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    const { email, name, picture } = payload

    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email])

    if (existing.rows.length > 0) {
      const user = existing.rows[0]

      if (user.is_banned) {
        return res.status(403).json({ message: 'Your account has been banned.' })
      }

      if (!user.profile_photo && picture) {
        await pool.query('UPDATE users SET profile_photo = $1 WHERE id = $2', [picture, user.id])
      }

      return res.json({
        token: generateToken(user.id),
        user: {
          id: user.id,
          fullName: user.full_name,
          username: user.username,
          email: user.email,
          college: user.college,
          profilePhoto: user.profile_photo || picture,
          isVerified: user.is_verified,
          userType: user.user_type,
          onboardingCompleted: user.onboarding_completed,
          isAdmin: user.is_admin,
          isBanned: user.is_banned,
        }
      })
    }

    // New user — create account
    let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
    if (baseUsername.length < 3) baseUsername = baseUsername + 'user'

    let username = baseUsername
    let counter = 1
    while (true) {
      const usernameCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username])
      if (usernameCheck.rows.length === 0) break
      username = `${baseUsername}${counter}`
      counter++
    }

    const result = await pool.query(
      `INSERT INTO users 
      (full_name, username, email, password, profile_photo, onboarding_completed) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, username, email, null, picture || null, false]
    )

    const newUser = result.rows[0]

    res.status(201).json({
      token: generateToken(newUser.id),
      user: {
        id: newUser.id,
        fullName: newUser.full_name,
        username: newUser.username,
        email: newUser.email,
        college: newUser.college,
        profilePhoto: newUser.profile_photo,
        isVerified: newUser.is_verified,
        userType: newUser.user_type,
        onboardingCompleted: newUser.onboarding_completed,
        isAdmin: newUser.is_admin,
        isBanned: newUser.is_banned,
      }
    })
  } catch (error) {
    console.error('Google login error:', error)
    res.status(500).json({ message: 'Google Sign In failed' })
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
      occupation: user.occupation,
      industry: user.industry,
      companySize: user.company_size,
      foundedYear: user.founded_year,
      specialities: user.specialities,
      currentCompany: user.current_company,
      isAdmin: user.is_admin,
      isBanned: user.is_banned,
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
    res.json({ message: 'Password reset link sent!', resetToken })
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

    if (!user.password) {
      return res.status(400).json({ message: 'Google Sign In accounts cannot change password.' })
    }

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

export const verifyStudent = async (req, res) => {
  const { method, institutionalEmail, college, idNumber, idPhoto } = req.body
  const userId = req.user.id
  try {
    if (method === 'email') {
      const institutionalEmailRegex = /^[^\s@]+@[^\s@]+\.(ac\.in|edu|ac\.uk|edu\.au|ac\.nz|edu\.in|ac\.za|edu\.sg)$/i
      if (!institutionalEmailRegex.test(institutionalEmail)) {
        return res.status(400).json({ message: 'Please use a valid institutional email address' })
      }
      await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [userId])
      return res.json({ message: 'Verified successfully!', verified: true })
    }
    await pool.query(
      'INSERT INTO verifications (user_id, college, id_number, id_photo, status) VALUES ($1, $2, $3, $4, $5)',
      [userId, college, idNumber, idPhoto || null, 'pending']
    )
    res.json({ message: 'Verification request submitted. We will review within 1-2 business days.' })
  } catch (error) {
    console.error('Verify student error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}