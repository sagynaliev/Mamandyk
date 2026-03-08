const router = require('express').Router();
const { pool } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const guard = [authMiddleware, requireRole('manager', 'admin')];

// GET /api/manager/stats
router.get('/stats', ...guard, async (req, res) => {
  try {
    const [students, results, topCareers] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE role='student'"),
      pool.query('SELECT COUNT(*) FROM test_results'),
      pool.query(`
        SELECT career->>'title' AS title, COUNT(*) AS cnt
        FROM test_results, jsonb_array_elements(careers) AS career
        GROUP BY title ORDER BY cnt DESC LIMIT 5
      `),
    ]);
    res.json({
      total_students: parseInt(students.rows[0].count),
      total_tests:    parseInt(results.rows[0].count),
      top_careers:    topCareers.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/manager/students
router.get('/students', ...guard, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.school,
             u.created_at, u.role, u.is_banned,
             COUNT(t.id)       AS test_count,
             MAX(t.created_at) AS last_test
      FROM users u
      LEFT JOIN test_results t ON t.user_id = u.id
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/manager/career-stats
router.get('/career-stats', ...guard, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT career->>'title' AS title, COUNT(*) AS count
      FROM test_results, jsonb_array_elements(careers) AS career
      GROUP BY title ORDER BY count DESC LIMIT 10
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/manager/questions  (тек қарау)
router.get('/questions', ...guard, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM questions ORDER BY question_id ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
