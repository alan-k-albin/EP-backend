import pool from '../config/db.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import xss from 'xss'

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

// ── TOKEN GENERATION ──────────────────────────────────────────────────────────

const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId, jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: '15m', algorithm: 'HS256' }
  )
}

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex')
}

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex')
}

const saveRefreshToken = async (userId, refreshToken) => {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const tokenHash = hashToken(refreshToken)
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [userId, refreshToken, tokenHash, expiresAt]
  )
}

// ── EMAIL VALIDATION ──────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

const isValidEmail = (email) => EMAIL_REGEX.test(email)

// ── USER FORMATTER ────────────────────────────────────────────────────────────

const formatUser = (user) => ({
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
})

// ── EXPLICIT USER COLUMNS (never SELECT *) ────────────────────────────────────

const USER_SAFE_COLUMNS = `
  id, full_name, username, email, college, bio, location, website,
  profile_photo, is_verified, is_private, user_type, onboarding_completed,
  occupation, industry, company_size, founded_year, specialities,
  current_company, is_admin, is_banned, google_id, created_at
`

// ── ACCOUNT LOCKOUT (PostgreSQL-backed) ───────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

const checkAccountLockout = async (email, ip) => {
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS)

  // Count failed attempts in last 15 min for this email OR this IP
  const result = await pool.query(
    `SELECT COUNT(*) FROM login_attempts
     WHERE (email = $1 OR ip_address = $2)
     AND attempted_at > $3`,
    [email.toLowerCase(), ip, windowStart]
  )

  const count = parseInt(result.rows[0].count)
  if (count >= MAX_FAILED_ATTEMPTS) {
    // Find the most recent attempt to calculate time remaining
    const latest = await pool.query(
      `SELECT attempted_at FROM login_attempts
       WHERE (email = $1 OR ip_address = $2)
       AND attempted_at > $3
       ORDER BY attempted_at DESC LIMIT 1`,
      [email.toLowerCase(), ip, windowStart]
    )
    const lastAttempt = new Date(latest.rows[0].attempted_at).getTime()
    const timeSinceLock = Date.now() - lastAttempt
    const minutesLeft = Math.ceil((LOCKOUT_WINDOW_MS - timeSinceLock) / 60000)
    return `Account temporarily locked. Try again in ${minutesLeft} minute(s).`
  }
  return false
}

const recordFailedAttempt = async (email, ip) => {
  await pool.query(
    'INSERT INTO login_attempts (email, ip_address) VALUES ($1, $2)',
    [email.toLowerCase(), ip]
  )
}

const clearFailedAttempts = async (email, ip) => {
  await pool.query(
    'DELETE FROM login_attempts WHERE email = $1 OR ip_address = $2',
    [email.toLowerCase(), ip]
  )
}

const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown'
  )
}

// ── REGISTER ──────────────────────────────────────────────────────────────────

export const register = async (req, res) => {
  const { fullName, username, email, college, password, userType } = req.body
  try {
    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ message: 'All required fields must be filled' })
    }

    // Sanitize string inputs
    const cleanFullName = xss(fullName.trim())
    const cleanUsername = xss(username.trim().toLowerCase())
    const cleanEmail = email.trim().toLowerCase()
    const cleanCollege = college ? xss(college.trim()) : null

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Invalid email format' })
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' })
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
      return res.status(400).json({ message: 'Username must be 3-30 characters, letters, numbers and underscores only' })
    }

    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [cleanEmail]
    )
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email already in use' })
    }

    const usernameCheck = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [cleanUsername]
    )
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Username already taken' })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const result = await pool.query(
      `INSERT INTO users
       (full_name, username, email, college, password, user_type, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${USER_SAFE_COLUMNS}`,
      [cleanFullName, cleanUsername, cleanEmail, cleanCollege, hashedPassword, userType || null, false]
    )

    const user = result.rows[0]
    const accessToken = generateAccessToken(user.id)
    const refreshToken = generateRefreshToken()
    await saveRefreshToken(user.id, refreshToken)

    res.status(201).json({
      message: 'Account created successfully!',
      accessToken,
      refreshToken,
      user: formatUser(user),
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────

export const login = async (req, res) => {
  const { email, password } = req.body
  const ip = getClientIp(req)

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const cleanEmail = email.trim().toLowerCase()

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Invalid email format' })
    }

    // Check lockout BEFORE hitting users table (prevents user enumeration timing)
    const lockoutMessage = await checkAccountLockout(cleanEmail, ip)
    if (lockoutMessage) {
      return res.status(429).json({ message: lockoutMessage })
    }

    const result = await pool.query(
      `SELECT ${USER_SAFE_COLUMNS}, password FROM users WHERE email = $1`,
      [cleanEmail]
    )

    if (result.rows.length === 0) {
      await recordFailedAttempt(cleanEmail, ip)
      // Constant-time response to prevent user enumeration
      await bcrypt.compare(password, '$2b$12$invalidhashfortimingnormalization000000000000000000000')
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const user = result.rows[0]

    if (!user.password) {
      return res.status(400).json({ message: 'This account uses Google Sign In. Please use the Google button.' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      await recordFailedAttempt(cleanEmail, ip)
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM login_attempts
         WHERE email = $1 AND attempted_at > $2`,
        [cleanEmail, new Date(Date.now() - LOCKOUT_WINDOW_MS)]
      )
      const count = parseInt(countResult.rows[0].count)
      const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - count)
      return res.status(401).json({
        message: remaining > 0
          ? `Invalid email or password. ${remaining} attempt(s) remaining.`
          : 'Account temporarily locked. Try again in 15 minutes.'
      })
    }

    if (user.is_banned) {
      return res.status(403).json({ message: 'Your account has been banned. Please contact support.' })
    }

    await clearFailedAttempts(cleanEmail, ip)

    const accessToken = generateAccessToken(user.id)
    const refreshToken = generateRefreshToken()
    await saveRefreshToken(user.id, refreshToken)

    res.json({
      message: 'Login successful!',
      accessToken,
      refreshToken,
      user: formatUser(user),
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ── GOOGLE LOGIN ──────────────────────────────────────────────────────────────

export const googleLogin = async (req, res) => {
  const { token } = req.body
  if (!token) {
    return res.status(400).json({ message: 'Google token is required' })
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload?.email_verified) {
      return res.status(401).json({ message: 'Google account email not verified' })
    }

    const { email, name, picture, sub: googleId } = payload
    const cleanEmail = email.trim().toLowerCase()

    const existing = await pool.query(
      `SELECT ${USER_SAFE_COLUMNS} FROM users WHERE email = $1`,
      [cleanEmail]
    )

    if (existing.rows.length > 0) {
      const user = existing.rows[0]
      if (user.is_banned) {
        return res.status(403).json({ message: 'Your account has been banned.' })
      }

      // Update google_id and profile photo if missing
      await pool.query(
        `UPDATE users SET
          google_id = COALESCE(google_id, $1),
          profile_photo = COALESCE(NULLIF(profile_photo, ''), $2)
         WHERE id = $3`,
        [googleId, picture || null, user.id]
      )

      const accessToken = generateAccessToken(user.id)
      const refreshToken = generateRefreshToken()
      await saveRefreshToken(user.id, refreshToken)

      return res.json({
        accessToken,
        refreshToken,
        user: { ...formatUser(user), profilePhoto: user.profile_photo || picture },
      })
    }

    // New user — generate unique username
    let baseUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
    if (baseUsername.length < 3) baseUsername = baseUsername + 'user'
    let username = baseUsername
    let counter = 1
    while (true) {
      const usernameCheck = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      )
      if (usernameCheck.rows.length === 0) break
      username = `${baseUsername}${counter}`
      counter++
    }

    const result = await pool.query(
      `INSERT INTO users
       (full_name, username, email, password, profile_photo, google_id, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${USER_SAFE_COLUMNS}`,
      [xss(name), username, cleanEmail, null, picture || null, googleId, false]
    )

    const newUser = result.rows[0]
    const accessToken = generateAccessToken(newUser.id)
    const refreshToken = generateRefreshToken()
    await saveRefreshToken(newUser.id, refreshToken)

    res.status(201).json({
      accessToken,
      refreshToken,
      user: formatUser(newUser),
    })
  } catch (error) {
    console.error('Google login error:', error)
    res.status(500).json({ message: 'Authentication failed' })
  }
}

// ── REFRESH TOKEN ─────────────────────────────────────────────────────────────

export const refreshToken = async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required' })
  }

  try {
    const tokenHash = hashToken(refreshToken)

    // Look up by hash, not plaintext
    const result = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()',
      [tokenHash]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' })
    }

    const tokenRow = result.rows[0]
    const userResult = await pool.query(
      `SELECT ${USER_SAFE_COLUMNS} FROM users WHERE id = $1`,
      [tokenRow.user_id]
    )

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' })
    }

    const user = userResult.rows[0]
    if (user.is_banned) {
      return res.status(403).json({ message: 'Your account has been banned.' })
    }

    // Rotate — delete old, issue new
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash])

    const newAccessToken = generateAccessToken(user.id)
    const newRefreshToken = generateRefreshToken()
    await saveRefreshToken(user.id, newRefreshToken)

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    })
  } catch (error) {
    console.error('Refresh token error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ── LOGOUT ────────────────────────────────────────────────────────────────────

export const logout = async (req, res) => {
  const { refreshToken } = req.body
  try {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken)
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash])
    }
    res.json({ message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ── LOGOUT ALL DEVICES ────────────────────────────────────────────────────────

export const logoutAll = async (req, res) => {
  const userId = req.user.id
  try {
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId])
    res.json({ message: 'Logged out from all devices' })
  } catch (error) {
    console.error('Logout all error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ── GET ME ────────────────────────────────────────────────────────────────────

export const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${USER_SAFE_COLUMNS} FROM users WHERE id = $1`,
      [req.user.id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }
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

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
// Token is stored HASHED in DB — never returned in API response
// Frontend must implement email delivery (e.g. SendGrid) to send the raw token

export const forgotPassword = async (req, res) => {
  const { email } = req.body
  try {
    if (!email || !isValidEmail(email.trim().toLowerCase())) {
      // Always return same message — don't reveal if email exists
      return res.json({ message: 'If an account exists, a reset link has been sent.' })
    }

    const cleanEmail = email.trim().toLowerCase()
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [cleanEmail]
    )

    if (result.rows.length === 0) {
      // Constant-time response — don't reveal email existence
      return res.json({ message: 'If an account exists, a reset link has been sent.' })
    }

    const userId = result.rows[0].id

    // Invalidate any existing reset tokens for this user
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [userId]
    )

    // Generate a secure random token
    const rawToken = crypto.randomBytes(64).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    )

    // TODO: Send rawToken via email (e.g. SendGrid) as part of a reset link:
    // https://ep-app.vercel.app/reset-password?token=<rawToken>
    // The rawToken is NEVER returned in the API response.
    console.info(`[DEV ONLY] Password reset token for ${cleanEmail}: ${rawToken}`)

    res.json({ message: 'If an account exists, a reset link has been sent.' })
  } catch (error) {
    console.error('Forgot password error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ── RESET PASSWORD ────────────────────────────────────────────────────────────

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body
  try {
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Reset token is required' })
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' })
    }

    const tokenHash = hashToken(token)

    const result = await pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > NOW() AND used = FALSE`,
      [tokenHash]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset token' })
    }

    const tokenRow = result.rows[0]
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, tokenRow.user_id])

    // Mark token as used (not deleted — keeps audit trail)
    await pool.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE id = $1',
      [tokenRow.id]
    )

    // Invalidate all active sessions on password reset
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [tokenRow.user_id])

    res.json({ message: 'Password reset successfully. Please log in again.' })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const userId = req.user.id
  try {
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' })
    }
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required' })
    }

    const result = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    )
    const user = result.rows[0]

    if (!user.password) {
      return res.status(400).json({ message: 'Google Sign In accounts cannot change password.' })
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' })
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from current password' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId])

    // Invalidate all sessions on password change
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId])

    res.json({ message: 'Password changed successfully. Please log in again.' })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ── CHANGE EMAIL ──────────────────────────────────────────────────────────────

export const changeEmail = async (req, res) => {
  const { email } = req.body
  const userId = req.user.id
  try {
    if (!email) {
      return res.status(400).json({ message: 'Email is required' })
    }

    const cleanEmail = email.trim().toLowerCase()

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Invalid email format' })
    }

    // Prevent changing to same email
    if (cleanEmail === req.user.email) {
      return res.status(400).json({ message: 'New email must be different from current email' })
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [cleanEmail]
    )
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email already in use' })
    }

    await pool.query('UPDATE users SET email = $1 WHERE id = $2', [cleanEmail, userId])

    res.json({ message: 'Email updated successfully!' })
  } catch (error) {
    console.error('Change email error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ── DELETE ACCOUNT ────────────────────────────────────────────────────────────

export const deleteAccount = async (req, res) => {
  const userId = req.user.id
  try {
    // Cascade will handle refresh_tokens if FK set up, but explicit is safer
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId])
    await pool.query('DELETE FROM users WHERE id = $1', [userId])
    res.json({ message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Delete account error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

// ── VERIFY STUDENT ────────────────────────────────────────────────────────────

export const verifyStudent = async (req, res) => {
  const { method, institutionalEmail, college, idNumber, idPhoto } = req.body
  const userId = req.user.id
  try {
    if (method === 'email') {
      if (!institutionalEmail) {
        return res.status(400).json({ message: 'Institutional email is required' })
      }

      const cleanInstitutionalEmail = institutionalEmail.trim().toLowerCase()
      const institutionalEmailRegex = /^[^\s@]+@[^\s@]+\.(ac\.in|edu|ac\.uk|edu\.au|ac\.nz|edu\.in|ac\.za|edu\.sg)$/i

      if (!institutionalEmailRegex.test(cleanInstitutionalEmail)) {
        return res.status(400).json({ message: 'Please use a valid institutional email address' })
      }

      // Prevent verifying with same email as account email
      if (cleanInstitutionalEmail === req.user.email) {
        return res.status(400).json({ message: 'Please use your institutional email, not your account email' })
      }

      // Check if this institutional email is already used for verification
      const emailInUse = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [cleanInstitutionalEmail, userId]
      )
      if (emailInUse.rows.length > 0) {
        return res.status(400).json({ message: 'This institutional email is already associated with another account' })
      }

      await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [userId])
      return res.json({ message: 'Verified successfully!', verified: true })
    }

    if (method === 'id') {
      if (!college || !idNumber) {
        return res.status(400).json({ message: 'College and ID number are required' })
      }

      // Check for duplicate pending verification
      const existing = await pool.query(
        `SELECT id FROM verifications WHERE user_id = $1 AND status = 'pending'`,
        [userId]
      )
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'You already have a pending verification request' })
      }

      await pool.query(
        'INSERT INTO verifications (user_id, college, id_number, id_photo, status) VALUES ($1, $2, $3, $4, $5)',
        [userId, xss(college), xss(idNumber), idPhoto || null, 'pending']
      )
      return res.json({ message: 'Verification request submitted. We will review within 1-2 business days.' })
    }

    return res.status(400).json({ message: 'Invalid verification method' })
  } catch (error) {
    console.error('Verify student error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}