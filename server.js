import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
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
import chatSocket from './sockets/chatSocket.js'

dotenv.config()

const app = express()
const httpServer = http.createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: 'https://ep-frontend-snowy.vercel.app',
    methods: ['GET', 'POST']
  }
})

app.use(cors({ origin: 'https://ep-frontend-snowy.vercel.app' }))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/posts', commentRoutes)
app.use('/api/connections', connectionRoutes)
app.use('/api/users', userRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/media', mediaRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'EP Backend is running!' })
})

chatSocket(io)

const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () => {
  console.log(`EP Server running on port ${PORT}`)
})