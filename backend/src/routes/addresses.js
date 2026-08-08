const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/addresses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC',
      [req.user.id]
    );
    res.json({ addresses: result.rows });
  } catch (err) {
    console.error('List addresses error', err);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

// POST /api/addresses
router.post('/', async (req, res) => {
  try {
    const { name, phone, line1, line2, city, state, pincode, isDefault } = req.body;
    if (!name || !line1 || !city || !state || !pincode) {
      return res.status(400).json({ error: 'name, line1, city, state, and pincode are required' });
    }

    if (isDefault) {
      await pool.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
    }

    const result = await pool.query(
      `INSERT INTO addresses (user_id, name, phone, line1, line2, city, state, pincode, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, name, phone, line1, line2 || null, city, state, pincode, !!isDefault]
    );

    res.status(201).json({ address: result.rows[0] });
  } catch (err) {
    console.error('Create address error', err);
    res.status(500).json({ error: 'Failed to create address' });
  }
});

// PUT /api/addresses/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, line1, line2, city, state, pincode, isDefault } = req.body;

    const owned = await pool.query('SELECT id FROM addresses WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    if (owned.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    if (isDefault) {
      await pool.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
    }

    const result = await pool.query(
      `UPDATE addresses SET
         name = COALESCE($1, name), phone = COALESCE($2, phone),
         line1 = COALESCE($3, line1), line2 = $4,
         city = COALESCE($5, city), state = COALESCE($6, state),
         pincode = COALESCE($7, pincode), is_default = COALESCE($8, is_default)
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [name, phone, line1, line2, city, state, pincode, isDefault, req.params.id, req.user.id]
    );

    res.json({ address: result.rows[0] });
  } catch (err) {
    console.error('Update address error', err);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

// DELETE /api/addresses/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id,
      req.user.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }
    res.json({ message: 'Address deleted' });
  } catch (err) {
    console.error('Delete address error', err);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

module.exports = router;