import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import hpp from 'hpp'
import xss from 'xss'
import jwt from 'jsonwebtoken'
import './config/db.js'
import authRoutes from './routes/auth.js'
import postRoutes from './routes/posts.js'
import commentRoutes from './routes/comments.js'
import connectionRoutes from './routes/connections.js'
import userRoutes from './routes/users.js'
import notificationRoutes from './routes/notifications.js'
import searchRoutes from './routes/search.js'
import chatRoutes from './routes/chat.js'
import mediaRoutes from './routes/media.js'
import pollRoutes from './routes/polls.js'
import adminRoutes from './routes/admin.js'
import chatSocket from './sockets/chatSocket.js'

dotenv.config()

const app = express()
const httpServer = http.createServer(app)

const allowedOrigins = [
  'https://ep-frontend-snowy.vercel.app',
  'https://ep-app.vercel.app',
  'http://localhost:5173'
]

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
})

// ── SECURITY HEADERS ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  // Production-grade Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],   // unsafe-inline needed for most React setups
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://lh3.googleusercontent.com'],
      connectSrc: ["'self'", ...allowedOrigins],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", 'https://res.cloudinary.com'],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  noSniff: true,         // X-Content-Type-Options: nosniff
  xssFilter: true,       // X-XSS-Protection
  hidePoweredBy: true,   // Remove X-Powered-By: Express
}))

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ── REQUEST SIZE LIMITS ───────────────────────────────────────────────────────
// 50kb for JSON API — media goes through Cloudinary, not JSON body
app.use(express.json({ limit: '50kb' }))
app.use(express.urlencoded({ extended: true, limit: '50kb' }))

// ── HTTP PARAMETER POLLUTION PROTECTION ───────────────────────────────────────
app.use(hpp())

// ── XSS SANITIZATION (xss library — not regex) ────────────────────────────────
// Handles encoded variants, SVG injection, attribute injection etc.
const xssOptions = {
  whiteList: {},          // No tags allowed — strip everything
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
}

const sanitizeValue = (value) => {
  if (typeof value === 'string') return xss(value, xssOptions)
  if (typeof value === 'object' && value !== null) return sanitizeObject(value)
  return value
}

const sanitizeObject = (obj) => {
  if (Array.isArray(obj)) return obj.map(sanitizeValue)
  const clean = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clean[key] = sanitizeValue(obj[key])
    }
  }
  return clean
}

app.use((req, res, next) => {
  if (req.body) req.body = sanitizeObject(req.body)
  if (req.query) req.query = sanitizeObject(req.query)
  if (req.params) req.params = sanitizeObject(req.params)
  next()
})

// ── RATE LIMITERS ─────────────────────────────────────────────────────────────

// Auth limiter — per IP + email
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const email = req.body?.email || req.body?.token || 'unknown'
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown'
    return `auth_${ip}_${email}`
  },
  skip: (req) => req.method === 'GET',
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Forgot password — tighter limit to prevent token-farming
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 3,                    // Only 3 reset requests per hour per IP
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown'
    return `forgot_${ip}`
  },
  message: { message: 'Too many password reset requests. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Post creation — keyed on decoded JWT user ID (not raw header, rotates)
const postCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    try {
      const token = req.headers.authorization?.split(' ')[1]
      if (!token) return `post_${req.ip}`
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
      return `post_user_${decoded.id}`
    } catch {
      return `post_${req.ip}`
    }
  },
  skip: (req) => req.method !== 'POST',
  message: { message: 'You are posting too fast. Please wait before posting again.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Media upload — keyed on decoded JWT user ID
const mediaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    try {
      const token = req.headers.authorization?.split(' ')[1]
      if (!token) return `media_${req.ip}`
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
      return `media_user_${decoded.id}`
    } catch {
      return `media_${req.ip}`
    }
  },
  message: { message: 'Too many uploads. Please wait before uploading again.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// General — keyed on decoded JWT user ID
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => {
    try {
      const token = req.headers.authorization?.split(' ')[1]
      if (!token) return `general_${req.ip}`
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
      return `general_user_${decoded.id}`
    } catch {
      return `general_${req.ip}`
    }
  },
  message: { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── APPLY RATE LIMITS ─────────────────────────────────────────────────────────
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/google', authLimiter)
app.use('/api/auth/forgot-password', forgotPasswordLimiter)
app.use('/api/posts', postCreationLimiter)
app.use('/api/media', mediaLimiter)
app.use('/api/connections', generalLimiter)
app.use('/api/users', generalLimiter)
app.use('/api/notifications', generalLimiter)
app.use('/api/search', generalLimiter)
app.use('/api/chat', generalLimiter)
app.use('/api/polls', generalLimiter)
app.use('/api/admin', generalLimiter)

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/posts', commentRoutes)
app.use('/api/connections', connectionRoutes)
app.use('/api/users', userRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/polls', pollRoutes)
app.use('/api/admin', adminRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'EP Backend is running!' })
})

// ── 404 HANDLER ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS error: Origin not allowed' })
  }
  res.status(500).json({ message: 'Internal server error' })
})

chatSocket(io)

const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () => {
  console.log(`EP Server running on port ${PORT}`)
})