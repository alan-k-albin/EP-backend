import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import hpp from 'hpp'
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
  contentSecurityPolicy: false,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
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

// ── REQUEST SIZE LIMIT ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── HTTP PARAMETER POLLUTION PROTECTION ───────────────────────────────────────
// Prevents attacks like ?email=a&email=b&email=c
app.use(hpp())

// ── XSS SANITIZATION ─────────────────────────────────────────────────────────
// Strip malicious HTML/JS from request body, params, query
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (!obj) return obj
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim()
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key])
      }
    }
    return obj
  }
  req.body = sanitize(req.body)
  req.query = sanitize(req.query)
  req.params = sanitize(req.params)
  next()
})

// ── RATE LIMITERS ─────────────────────────────────────────────────────────────

// Auth limiter — per IP + email (stops brute force per account)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const email = req.body?.email || req.body?.token || 'unknown'
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown'
    return `auth_${ip}_${email}`
  },
  skip: (req) => req.method === 'GET',
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Post creation: 5 posts per 15 mins per user
const postCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const auth = req.headers.authorization || 'unknown'
    return `post_${auth}`
  },
  skip: (req) => req.method !== 'POST',
  message: { message: 'You are posting too fast. Please wait before posting again.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Media upload: 10 uploads per 15 mins per user
const mediaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const auth = req.headers.authorization || 'unknown'
    return `media_${auth}`
  },
  message: { message: 'Too many uploads. Please wait before uploading again.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// General: 100 requests per 15 mins per user
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => {
    const auth = req.headers.authorization || req.ip || 'unknown'
    return `general_${auth}`
  },
  message: { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── APPLY RATE LIMITS ─────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter)
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
  // Never expose error details in production
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