import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
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
}))

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({ origin: allowedOrigins }))

// ── REQUEST SIZE LIMIT ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── RATE LIMITERS ─────────────────────────────────────────────────────────────

// Auth: 5 attempts per 15 mins (stops brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET', // Don't limit GET /auth/me
})

// Post creation: 5 posts per 15 mins (stops spam)
const postCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'You are posting too fast. Please wait before posting again.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST', // Only limit POST requests
})

// Media upload: 10 uploads per 15 mins
const mediaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many uploads. Please wait before uploading again.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// General: 100 requests per 15 mins
// Applied to all routes EXCEPT auth and media (they have their own limiters)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── APPLY RATE LIMITS ─────────────────────────────────────────────────────────
// Apply specific limiters first, then general to remaining routes
app.use('/api/auth', authLimiter)
app.use('/api/posts', postCreationLimiter)
app.use('/api/media', mediaLimiter)

// General limiter excludes auth, posts and media (already limited above)
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
  res.status(500).json({ message: 'Internal server error' })
})

chatSocket(io)

const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () => {
  console.log(`EP Server running on port ${PORT}`)
})