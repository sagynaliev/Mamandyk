const router = require('express').Router();
const { pool } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const VALID_ROLES = ['student', 'manager', 'admin', 'mentor'];
const guard       = [authMiddleware, requireRole('admin')];

// ── Пайдаланушылар ─────────────────────────────────────

// GET /api/admin/users
router.get('/users', ...guard, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.school,
             u.role, u.is_banned, u.created_at,
             COUNT(t.id) AS test_count
      FROM users u
      LEFT JOIN test_results t ON t.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', ...guard, async (req, res) => {
  const { role } = req.body;
  const userId   = parseInt(req.params.id);

  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ error: 'Дұрыс емес рөл' });
  if (userId === req.user.id)
    return res.status(400).json({ error: 'Өз рөліңізді өзгерте алмайсыз' });

  try {
    const { rows } = await pool.query(
      'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, first_name, last_name, email, role',
      [role, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Пайдаланушы табылмады' });
    console.log(`✅ User ${userId} рөлі → ${role}`);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', ...guard, async (req, res) => {
  const { banned } = req.body;
  const userId     = parseInt(req.params.id);

  if (userId === req.user.id)
    return res.status(400).json({ error: 'Өзіңізді бандай алмайсыз' });

  try {
    const { rows } = await pool.query(
      'UPDATE users SET is_banned=$1 WHERE id=$2 RETURNING id, first_name, last_name, email, is_banned',
      [banned, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Пайдаланушы табылмады' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', ...guard, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (userId === req.user.id)
    return res.status(400).json({ error: 'Өзіңізді жоя алмайсыз' });

  try {
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Сұрақтар CRUD ──────────────────────────────────────

// GET /api/admin/questions
router.get('/questions', ...guard, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM questions ORDER BY question_id ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/questions
router.post('/questions', ...guard, async (req, res) => {
  const { question_text, category } = req.body;
  if (!question_text)
    return res.status(400).json({ error: 'Сұрақ мәтіні жоқ' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO questions(question_text, category) VALUES($1,$2) RETURNING *',
      [question_text, category || 'general']
    );
    console.log('✅ Жаңа сұрақ:', rows[0].question_id);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/questions/:id
router.put('/questions/:id', ...guard, async (req, res) => {
  const { question_text, category } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE questions SET question_text=$1, category=$2 WHERE question_id=$3 RETURNING *',
      [question_text, category, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Сұрақ табылмады' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/questions/:id
router.delete('/questions/:id', ...guard, async (req, res) => {
  try {
    await pool.query('DELETE FROM questions WHERE question_id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/system-stats
router.get('/system-stats', ...guard, async (req, res) => {
  try {
    const [byRole, tests, questions] = await Promise.all([
      pool.query('SELECT role, COUNT(*) AS count FROM users GROUP BY role'),
      pool.query('SELECT COUNT(*) FROM test_results'),
      pool.query('SELECT COUNT(*) FROM questions'),
    ]);
    res.json({
      users_by_role:   byRole.rows,
      total_tests:     parseInt(tests.rows[0].count),
      total_questions: parseInt(questions.rows[0].count),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
