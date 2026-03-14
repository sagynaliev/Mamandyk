require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────
app.use(cors({
  origin:      process.env.ALLOWED_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ── DB (import = init) ────────────────────────────────
const { dbOK } = require('./config/db');

// ── Health ────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', db: require('./config/db').dbOK, ai: 'groq' });
});

// ── Auth ──────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// ── Student ───────────────────────────────────────────
const studentRouter = require('./routes/student');
app.use('/api/questions', studentRouter);   // GET  /api/questions
app.use('/api/test',      studentRouter);   // POST /api/test/verdict
app.use('/api/results',   studentRouter);   // GET  /api/results/my  |  /api/results/:id
// roadmap: student router-дің /roadmap endpoint-іне тікелей бағыттау
app.post('/api/roadmap', (req, res, next) => { req.url = '/roadmap'; studentRouter(req, res, next); });

// Legacy alias — results.html /api/get-ai-verdict → /api/test/verdict
const { askGroq, parseJSON, fallbackVerdict } = require('./services/groq');
const jwt = require('jsonwebtoken');
app.post('/api/get-ai-verdict', async (req, res) => {
  const { answers } = req.body;
  if (!answers || !Object.keys(answers).length)
    return res.status(400).json({ error: 'Жауаптар жоқ' });
  let result = null;
  try {
    const prompt = `Пайдаланушының кәсіби бейімділік тесті жауаптары: ${JSON.stringify(answers)}
Шкала: -3..+3. Тек таза JSON қайтар:
{"insight":"2-3 сөйлем қазақша","personality":[{"left":"Аналитика","leftVal":70,"right":"Шығармашылық","rightVal":30},{"left":"Интроверт","leftVal":40,"right":"Экстраверт","rightVal":60},{"left":"Теория","leftVal":55,"right":"Тәжірибе","rightVal":45},{"left":"Тұрақтылық","leftVal":65,"right":"Икемділік","rightVal":35}],"careers":[{"title":"...","score":95,"verdict":"...","salary":"...₸","growth":"..."}]}
3-5 мамандық, score кему ретінде, барлығы қазақша.`;
    result = parseJSON(await askGroq(prompt));
  } catch { result = fallbackVerdict(); }
  // Save to DB if token present
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) {
    try {
      const { pool } = require('./config/db');
      const dec = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET || 'mamandyk_super_secret_key_2025');
      await pool.query(
        'INSERT INTO test_results(user_id,answers,insight,personality,careers) VALUES($1,$2,$3,$4,$5)',
        [dec.id, JSON.stringify(answers), result.insight, JSON.stringify(result.personality), JSON.stringify(result.careers)]
      );
    } catch {}
  }
  res.json(result);
});

// ── Manager ───────────────────────────────────────────
app.use('/api/manager', require('./routes/manager'));

// ── Admin ─────────────────────────────────────────────
app.use('/api/admin', require('./routes/admin'));

// ── Simulator ─────────────────────────────────────────
const aiRouter = require('./routes/ai');
app.use('/api/simulator', aiRouter);   // POST /api/simulator/tasks



// ── 404 ──────────────────────────────────────────────
app.use('/api/{*path}', (req, res) => {
  res.status(404).json({ error: `Endpoint табылмады: ${req.method} ${req.path}` });
});

// ── Frontend catch-all ────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Start ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Mamandyk — http://localhost:${PORT}`);
  console.log(`   AI   : Groq (llama-3.3-70b-versatile)`);
  console.log(`   DB   : ${process.env.DB_NAME || 'mamandyk_db'}`);
  console.log(`   CORS : ${process.env.ALLOWED_ORIGIN || '*'}`);
  console.log(`   NODE : ${process.version}\n`);
});
