import express from 'express'
import { uploadMedia, uploadProfilePhoto } from '../controllers/mediaController.js'
import protect from '../middleware/authMiddleware.js'
import upload from '../middleware/uploadMiddleware.js'

const router = express.Router()

router.post('/upload', protect, upload.single('file'), uploadMedia)
router.post('/profile-photo', protect, upload.single('file'), uploadProfilePhoto)

export default router