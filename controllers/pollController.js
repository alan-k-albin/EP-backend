import pool from '../config/db.js'

export const createPoll = async (req, res) => {
  const { postId, options } = req.body
  try {
    const poll = await pool.query(
      'INSERT INTO polls (post_id) VALUES ($1) RETURNING *',
      [postId]
    )
    const pollId = poll.rows[0].id
    for (const option of options) {
      await pool.query(
        'INSERT INTO poll_options (poll_id, option_text) VALUES ($1, $2)',
        [pollId, option]
      )
    }
    const pollOptions = await pool.query(
      'SELECT * FROM poll_options WHERE poll_id = $1',
      [pollId]
    )
    res.status(201).json({ poll: poll.rows[0], options: pollOptions.rows })
  } catch (error) {
    console.error('Create poll error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const getPoll = async (req, res) => {
  const { postId } = req.params
  const userId = req.user.id
  try {
    const poll = await pool.query('SELECT * FROM polls WHERE post_id = $1', [postId])
    if (poll.rows.length === 0) return res.json(null)

    const pollId = poll.rows[0].id
    const options = await pool.query(
      `SELECT po.*, COUNT(pv.id) as vote_count,
      EXISTS(SELECT 1 FROM poll_votes pv2 WHERE pv2.poll_option_id = po.id AND pv2.user_id = $1) as user_voted
      FROM poll_options po
      LEFT JOIN poll_votes pv ON pv.poll_option_id = po.id
      WHERE po.poll_id = $2
      GROUP BY po.id`,
      [userId, pollId]
    )

    const totalVotes = options.rows.reduce((sum, o) => sum + parseInt(o.vote_count), 0)

    res.json({
      poll: poll.rows[0],
      options: options.rows,
      totalVotes,
      userVoted: options.rows.some((o) => o.user_voted),
    })
  } catch (error) {
    console.error('Get poll error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

export const votePoll = async (req, res) => {
  const { optionId } = req.body
  const userId = req.user.id
  try {
    const option = await pool.query('SELECT * FROM poll_options WHERE id = $1', [optionId])
    const pollId = option.rows[0].poll_id

    const existingVote = await pool.query(
      `SELECT pv.* FROM poll_votes pv
      JOIN poll_options po ON pv.poll_option_id = po.id
      WHERE po.poll_id = $1 AND pv.user_id = $2`,
      [pollId, userId]
    )

    if (existingVote.rows.length > 0) {
      return res.status(400).json({ message: 'Already voted' })
    }

    await pool.query(
      'INSERT INTO poll_votes (poll_option_id, user_id) VALUES ($1, $2)',
      [optionId, userId]
    )
    res.json({ message: 'Vote recorded' })
  } catch (error) {
    console.error('Vote poll error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}