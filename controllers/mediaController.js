import cloudinary from '../config/cloudinary.js'

export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const isVideo = req.file.mimetype.startsWith('video/')

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: isVideo ? 'video' : 'image',
          folder: 'EP',
          transformation: isVideo
            ? [{ quality: 'auto' }]
            : [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      ).end(req.file.buffer)
    })

    res.json({
      url: result.secure_url,
      mediaType: isVideo ? 'video' : 'image',
      publicId: result.public_id,
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ message: 'Upload failed' })
  }
}

export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'EP/profiles',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      ).end(req.file.buffer)
    })

    await import('../config/db.js').then(async ({ default: pool }) => {
      await pool.query(
        'UPDATE users SET profile_photo = $1 WHERE id = $2',
        [result.secure_url, req.user.id]
      )
    })

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
    })
  } catch (error) {
    console.error('Profile photo upload error:', error)
    res.status(500).json({ message: 'Upload failed' })
  }
}