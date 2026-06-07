import express from 'express'
import {
  sendRequest,
  acceptRequest,
  declineRequest,
  removeConnection,
  getMyConnections,
  getPendingRequests
} from '../controllers/connectionController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/request', protect, sendRequest)
router.put('/accept/:id', protect, acceptRequest)
router.delete('/decline/:id', protect, declineRequest)
router.delete('/remove/:id', protect, removeConnection)
router.get('/my', protect, getMyConnections)
router.get('/pending', protect, getPendingRequests)

export default router