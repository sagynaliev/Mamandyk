const express    = require('express');
const { Pool }   = require('pg');
const cors       = require('cors');
const path       = require('path');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const JWT_SECRET = process.env.JWT_SECRET || 'mamandyk_secret_2025';
const PORT       = process.env.PORT || 5000;

// ── PostgreSQL ───────────────────────────────────────────
const pool = new Pool({
  user:     process.env.DB_USER     || 'postgres',
  host:     process.env.DB_HOST     || 'localhost',
  database: process.env.DB_NAME     || 'mamandyk',
  password: process.env.DB_PASSWORD || '',
  port:     parseInt(process.env.DB_PORT) || 5432,
});

let dbOK = false;
pool.connect()
  .then(async c => { dbOK = true; c.release(); await initDB(); console.log('✅ PostgreSQL қосылды'); })
  .catch(e => console.warn('⚠️  PostgreSQL жоқ, demo режимі:', e.message));

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL, email VARCHAR(200) UNIQUE NOT NULL,
      password VARCHAR(200) NOT NULL, school VARCHAR(200), created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS questions (
      question_id SERIAL PRIMARY KEY, question_text TEXT NOT NULL,
      category VARCHAR(100), created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS test_results (
      id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      answers JSONB NOT NULL, insight TEXT, personality JSONB, careers JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  const { rows } = await pool.query('SELECT COUNT(*) FROM questions');
  if (parseInt(rows[0].count) === 0) {
    const qs = [
      ["Мен командамен жұмыс істегенді ұнатамын","social"],
      ["Маған нақты есептерді шешу қызық","analytical"],
      ["Шығармашылық жұмыс маған рахат береді","creative"],
      ["Жаңа адамдармен танысуды жақсы көремін","social"],
      ["Аналитикалық ойлау — менің күшті жағым","analytical"],
      ["Техникалық жабдықтармен жұмыс істеуді ұнатамын","technical"],
      ["Әдебиет пен өнер маған жақын","creative"],
      ["Басшылық ету рөлі маған сәйкес","leadership"],
      ["Тәжірибелік жұмыс теориядан маңыздырақ","practical"],
      ["Ғылымды зерттеу — менің арманым","analytical"],
      ["Адамдарға көмек беру — маған мәнді","social"],
      ["Жоба жоспарлауды жақсы көремін","leadership"],
      ["Деректермен жұмыс істеуді ұнатамын","analytical"],
      ["Табиғат пен экология мені қызықтырады","science"],
      ["Экономика мен бизнес маған жақын","business"],
      ["Спорт пен физикалық белсенділік маңызды","physical"],
      ["Тарих пен мәдениетті зерттеуді ұнатамын","humanities"],
      ["Заң мен қоғамдық тәртіп маңызды","legal"],
      ["Медицина мен денсаулық саласы маған қызық","medical"],
      ["Инновация мен стартап идеялары мені шабыттандырады","business"],
    ];
    for (const [t,c] of qs) await pool.query('INSERT INTO questions(question_text,category) VALUES($1,$2)',[t,c]);
    console.log('✅ 20 demo сұрақ қосылды');
  }
}

// ── JWT middleware ───────────────────────────────────────
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token жоқ' });
  try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token жарамсыз' }); }
}

function getDemoQuestions() {
  return ["Мен командамен жұмыс істегенді ұнатамын","Маған нақты есептерді шешу қызық","Шығармашылық жұмыс маған рахат береді","Жаңа адамдармен танысуды жақсы көремін","Аналитикалық ойлау — менің күшті жағым","Техникалық жабдықтармен жұмыс істеуді ұнатамын","Әдебиет пен өнер маған жақын","Басшылық ету рөлі маған сәйкес","Тәжірибелік жұмыс теориядан маңыздырақ","Ғылымды зерттеу — менің арманым","Адамдарға көмек беру — маған мәнді","Жоба жоспарлауды жақсы көремін","Деректермен жұмыс істеуді ұнатамын","Табиғат пен экология мені қызықтырады","Экономика мен бизнес маған жақын","Спорт пен физикалық белсенділік маңызды","Тарих пен мәдениетті зерттеуді ұнатамын","Заң мен қоғамдық тәртіп маңызды","Медицина мен денсаулық саласы маған қызық","Инновация мен стартап идеялары мені шабыттандырады"]
    .map((t,i) => ({question_id:i+1, question_text:t}));
}

function fallbackAI() {
  return {
    insight: 'Сіздің жауаптарыңыз аналитикалық қабілеттіліктің жоғары деңгейін көрсетеді. Командада жұмыс істеуге бейімсіз, өз бетіңізше шешім қабылдай аласыз.',
    personality: [
      {left:'Аналитика',leftVal:68,right:'Шығармашылық',rightVal:32},
      {left:'Интроверт',leftVal:45,right:'Экстраверт',rightVal:55},
      {left:'Теория',leftVal:40,right:'Тәжірибе',rightVal:60},
      {left:'Тұрақтылық',leftVal:70,right:'Икемділік',rightVal:30},
    ],
    careers: [
      {title:'Software Engineer',score:94,verdict:'Логикалық ойлауыңыз техникалық салада керемет нәтиже береді.',salary:'500k–1.5M ₸',growth:'Өте жоғары'},
      {title:'Data Scientist',score:87,verdict:'Деректер анализі — сіздің аналитикалық санаңызға сай.',salary:'600k–1.8M ₸',growth:'Жоғары'},
      {title:'Product Manager',score:79,verdict:'Стратегиялық ойлауыңыз өнімді басқаруда тиімді.',salary:'400k–1.2M ₸',growth:'Жоғары'},
    ]
  };
}

// ════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════

app.get('/api/health', (req, res) => res.json({ status:'OK', db:dbOK }));

// Тіркелу
app.post('/api/auth/register', async (req, res) => {
  const { first_name, last_name, email, school, password } = req.body;
  if (!first_name||!last_name||!email||!password)
    return res.status(400).json({ error:'Барлық өрістерді толтырыңыз' });
  if (password.length < 6)
    return res.status(400).json({ error:'Құпиясөз кем дегенде 6 таңба' });
  try {
    const ex = await pool.query('SELECT id FROM users WHERE email=$1',[email.toLowerCase()]);
    if (ex.rows.length) return res.status(409).json({ error:'Бұл email тіркелген' });
    const hash = await bcrypt.hash(password, 12);
    const {rows} = await pool.query(
      'INSERT INTO users(first_name,last_name,email,school,password) VALUES($1,$2,$3,$4,$5) RETURNING id,first_name,last_name,email,school,created_at',
      [first_name,last_name,email.toLowerCase(),school||null,hash]
    );
    const token = jwt.sign({id:rows[0].id,email:rows[0].email}, JWT_SECRET, {expiresIn:'30d'});
    res.json({ token, user:rows[0] });
  } catch(e) { res.status(500).json({ error:'Тіркелу мүмкін болмады' }); }
});

// Кіру
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email||!password) return res.status(400).json({ error:'Email мен құпиясөз қажет' });
  try {
    const {rows} = await pool.query('SELECT * FROM users WHERE email=$1',[email.toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error:'Пайдаланушы табылмады' });
    const ok = await bcrypt.compare(password, rows[0].password);
    if (!ok) return res.status(401).json({ error:'Құпиясөз дұрыс емес' });
    const {password:_, ...user} = rows[0];
    const token = jwt.sign({id:user.id,email:user.email}, JWT_SECRET, {expiresIn:'30d'});
    res.json({ token, user });
  } catch { res.status(500).json({ error:'Кіру мүмкін болмады' }); }
});

// Профильді жаңарту
app.put('/api/auth/profile', auth, async (req, res) => {
  const { first_name, last_name, school } = req.body;
  try {
    const {rows} = await pool.query(
      'UPDATE users SET first_name=$1,last_name=$2,school=$3 WHERE id=$4 RETURNING id,first_name,last_name,email,school,created_at',
      [first_name,last_name,school||null,req.user.id]
    );
    res.json(rows[0]);
  } catch { res.status(500).json({ error:'Жаңарту мүмкін болмады' }); }
});

// Сұрақтарды алу
app.get('/api/questions', async (req, res) => {
  try {
    const {rows} = await pool.query('SELECT question_id,question_text FROM questions ORDER BY question_id ASC');
    res.json(rows.length ? rows : getDemoQuestions());
  } catch { res.json(getDemoQuestions()); }
});

// AI verdict + нәтижені сақтау
app.post('/api/get-ai-verdict', async (req, res) => {
  const { answers } = req.body;
  if (!answers||!Object.keys(answers).length)
    return res.status(400).json({ error:'Жауаптар жоқ' });

  let result = null;
  try {
    const model = genAI.getGenerativeModel({ model:'gemini-2.0-flash' });
    const prompt = `Пайдаланушының тест жауаптары: ${JSON.stringify(answers)}
Шкала: -3...+3. Тек таза JSON қайтар:
{"insight":"2-3 сөйлем қазақша","personality":[{"left":"Аналитика","leftVal":70,"right":"Шығармашылық","rightVal":30},{"left":"Интроверт","leftVal":40,"right":"Экстраверт","rightVal":60},{"left":"Теория","leftVal":55,"right":"Тәжірибе","rightVal":45},{"left":"Тұрақтылық","leftVal":65,"right":"Икемділік","rightVal":35}],"careers":[{"title":"...","score":95,"verdict":"...","salary":"...₸","growth":"..."}]}
3-5 мамандық, score бойынша кему ретінде.`;
    const r = await model.generateContent(prompt);
    const m = r.response.text().match(/\{[\s\S]*\}/);
    if (m) result = JSON.parse(m[0]);
  } catch(e) { console.warn('AI қатесі:', e.message); }

  if (!result) result = fallbackAI();

  // Token болса DB-ге сақтау
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ') && dbOK) {
    try {
      const dec = jwt.verify(h.split(' ')[1], JWT_SECRET);
      await pool.query(
        'INSERT INTO test_results(user_id,answers,insight,personality,careers) VALUES($1,$2,$3,$4,$5)',
        [dec.id, JSON.stringify(answers), result.insight, JSON.stringify(result.personality), JSON.stringify(result.careers)]
      );
      console.log(`✅ User ${dec.id} — тест нәтижесі сақталды`);
    } catch(e) { console.warn('Сақтау қатесі:', e.message); }
  }

  res.json(result);
});

// Менің нәтижелерім
app.get('/api/results/my', auth, async (req, res) => {
  try {
    const {rows} = await pool.query(
      'SELECT id,insight,personality,careers,created_at FROM test_results WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch { res.status(500).json({ error:'Нәтижелерді алу мүмкін болмады' }); }
});

// Жеке нәтиже
app.get('/api/results/:id', auth, async (req, res) => {
  try {
    const {rows} = await pool.query(
      'SELECT * FROM test_results WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error:'Нәтиже табылмады' });
    res.json(rows[0]);
  } catch { res.status(500).json({ error:'Қате' }); }
});

// AI Roadmap — мамандық бойынша жол картасы
app.post('/api/roadmap', async (req, res) => {
  const { career, verdict } = req.body;
  if (!career) return res.status(400).json({ error: 'Мамандық атауы жоқ' });

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `Мен "${career}" мамандығын таңдағым келеді.${verdict ? ' Себебі: ' + verdict : ''}

Осы мамандыққа жету үшін нақты жол картасын (roadmap) жасап бер.

Тек таза JSON форматында қайтар:
{
  "summary": "1-2 сөйлемдік қысқаша қазақша сипаттама",
  "steps": [
    {
      "title": "Қадам атауы қазақша",
      "description": "Не үйрену керек, қанша уақыт кетеді — 2-3 сөйлем қазақша",
      "skills": ["Дағды 1", "Дағды 2", "Дағды 3"]
    }
  ]
}

5-7 қадам болсын, нақты және пайдалы болсын. Барлығы қазақша.`;

    const r = await model.generateContent(prompt);
    const m = r.response.text().match(/\{[\s\S]*\}/);
    if (!m) throw new Error('JSON табылмады');
    res.json(JSON.parse(m[0]));
  } catch(e) {
    console.warn('Roadmap AI қатесі:', e.message);
    // Fallback roadmap
    res.json({
      summary: `${career} мамандығына жету үшін жүйелі оқу мен тәжірибе қажет.`,
      steps: [
        { title: '1. Негіздерді үйрену', description: 'Салаға байланысты базалық білімді игеру. Онлайн курстар мен оқулықтар қолдан бастау.', skills: ['Теориялық база', 'Онлайн курстар', 'Кітаптар'] },
        { title: '2. Практикалық жаттығу', description: 'Алған білімді тәжірибеде қолдану. Шағын жобалар жасап бастау.', skills: ['Pet project', 'Тәжірибе', 'Портфолио'] },
        { title: '3. Мамандану', description: 'Белгілі бір бағытты таңдап тереңдету. Сала экспертерінен үйрену.', skills: ['Мамандану', 'Ментор', 'Практика'] },
        { title: '4. Жұмыс іздеу', description: 'Резюме жазу, сұхбатқа дайындалу, стажировкаға өтіну.', skills: ['Резюме', 'LinkedIn', 'Нетворкинг'] },
        { title: '5. Мансаптық өсу', description: 'Үздіксіз дамып, тәжірибе жинақтау. Сертификаттар алу.', skills: ['Сертификат', 'Конференция', 'Оқу'] },
      ]
    });
  }
});

// Save last careers to make careers page work without auth
app.post('/api/save-careers', async (req, res) => {
  // Just returns OK — frontend saves to localStorage
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Mamandyk backend http://localhost:${PORT}\n`);
});
