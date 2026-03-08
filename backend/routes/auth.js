const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { pool, dbOK } = require('../config/db');
const { authMiddleware, sanitize, signToken } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { first_name, last_name, email, school, password } = req.body;

  if (!first_name || !last_name || !email || !password)
    return res.status(400).json({ error: 'Барлық өрістерді толтырыңыз' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Құпиясөз кем дегенде 6 таңба' });

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email=$1',
      [email.toLowerCase()]
    );
    if (existing.rows.length)
      return res.status(409).json({ error: 'Бұл email тіркелген' });

    const hash       = await bcrypt.hash(password, 12);
    const cleanFirst = sanitize(first_name.trim());
    const cleanLast  = sanitize(last_name.trim());

    const { rows } = await pool.query(
      `INSERT INTO users(first_name, last_name, email, school, password, role)
       VALUES($1,$2,$3,$4,$5,'student')
       RETURNING id, first_name, last_name, email, school, role, created_at`,
      [cleanFirst, cleanLast, email.toLowerCase(), school?.trim() || null, hash]
    );

    const token = signToken({ id: rows[0].id, email: rows[0].email, role: rows[0].role });
    console.log('✅ Тіркелді:', rows[0].email);
    res.json({ token, user: rows[0] });
  } catch (e) {
    console.error('❌ Register:', e.message);
    res.status(500).json({ error: 'Тіркелу мүмкін болмады' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email мен құпиясөз қажет' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email=$1',
      [email.toLowerCase()]
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Пайдаланушы табылмады' });
    if (rows[0].is_banned)
      return res.status(403).json({ error: 'Аккаунт бұғатталған' });

    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid)
      return res.status(401).json({ error: 'Құпиясөз дұрыс емес' });

    const { password: _pw, ...user } = rows[0];
    const token = signToken({ id: user.id, email: user.email, role: user.role });

    console.log('✅ Кірді:', user.email, '| Рөл:', user.role);
    res.json({ token, user });
  } catch (e) {
    console.error('❌ Login:', e.message);
    res.status(500).json({ error: 'Кіру мүмкін болмады' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  const { first_name, last_name, school } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET first_name=$1, last_name=$2, school=$3
       WHERE id=$4
       RETURNING id, first_name, last_name, email, school, role, created_at`,
      [sanitize(first_name), sanitize(last_name), school?.trim() || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Профильді жаңарту мүмкін болмады' });
  }
});

module.exports = router;