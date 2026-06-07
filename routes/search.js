import express from 'express'
import { search } from '../controllers/searchController.js'
import protect from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', protect, search)

export default router