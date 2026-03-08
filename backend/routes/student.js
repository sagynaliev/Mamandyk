const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const { pool } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { askGroq, parseJSON, fallbackVerdict } = require('../services/groq');

const JWT_SECRET = process.env.JWT_SECRET || 'mamandyk_super_secret_key_2025';

// Demo сұрақтар (DB жоқ кезде)
function getDemoQuestions() {
  return [
    'Мен командамен жұмыс істегенді ұнатамын',
    'Маған нақты есептерді шешу қызық',
    'Шығармашылық жұмыс маған рахат береді',
    'Жаңа адамдармен танысуды жақсы көремін',
    'Аналитикалық ойлау — менің күшті жағым',
    'Техникалық жабдықтармен жұмыс істеуді ұнатамын',
    'Әдебиет пен өнер маған жақын',
    'Басшылық ету рөлі маған сәйкес',
    'Тәжірибелік жұмыс теориядан маңыздырақ',
    'Ғылымды зерттеу — менің арманым',
    'Адамдарға көмек беру — маған мәнді',
    'Жоба жоспарлауды жақсы көремін',
    'Деректермен жұмыс істеуді ұнатамын',
    'Табиғат пен экология мені қызықтырады',
    'Экономика мен бизнес маған жақын',
    'Спорт пен физикалық белсенділік маңызды',
    'Тарих пен мәдениетті зерттеуді ұнатамын',
    'Заң мен қоғамдық тәртіп маңызды',
    'Медицина мен денсаулық саласы маған қызық',
    'Инновация мен стартап идеялары мені шабыттандырады',
  ].map((text, i) => ({ question_id: i + 1, question_text: text }));
}

// GET /api/questions
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT question_id, question_text, category FROM questions ORDER BY question_id ASC'
    );
    res.json(rows.length ? rows : getDemoQuestions());
  } catch {
    res.json(getDemoQuestions());
  }
});

// POST /api/test/verdict  — AI тест нәтижесі
router.post('/verdict', async (req, res) => {
  const { answers } = req.body;
  if (!answers || !Object.keys(answers).length)
    return res.status(400).json({ error: 'Жауаптар жоқ' });

  let result = null;
  try {
    console.log('🤖 Groq AI талдауда...');
    const prompt = `Пайдаланушының кәсіби бейімділік тесті жауаптары (сұрақ ID: мән):
${JSON.stringify(answers)}
Шкала: -3..+3. Тек таза JSON қайтар:
{"insight":"2-3 сөйлем қазақша","personality":[{"left":"Аналитика","leftVal":70,"right":"Шығармашылық","rightVal":30},{"left":"Интроверт","leftVal":40,"right":"Экстраверт","rightVal":60},{"left":"Теория","leftVal":55,"right":"Тәжірибе","rightVal":45},{"left":"Тұрақтылық","leftVal":65,"right":"Икемділік","rightVal":35}],"careers":[{"title":"...","score":95,"verdict":"...","salary":"...₸","growth":"..."}]}
3-5 мамандық, score кему ретінде, барлығы қазақша.`;

    const text = await askGroq(prompt);
    result = parseJSON(text);
  } catch (e) {
    console.error('❌ Groq қатесі:', e.message);
    result = fallbackVerdict();
  }

  // Нәтижені DB-ге сақтау (егер token болса)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      await pool.query(
        'INSERT INTO test_results(user_id, answers, insight, personality, careers) VALUES($1,$2,$3,$4,$5)',
        [decoded.id, JSON.stringify(answers), result.insight, JSON.stringify(result.personality), JSON.stringify(result.careers)]
      );
      console.log(`✅ User ${decoded.id} тест нәтижесі сақталды`);
    } catch (e) {
      console.warn('⚠️ DB сақтау:', e.message);
    }
  }

  res.json(result);
});

// GET /api/results/my
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, insight, personality, careers, created_at FROM test_results WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Нәтижелерді алу мүмкін болмады' });
  }
});

// GET /api/results/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM test_results WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Нәтиже табылмады' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Серверде қате' });
  }
});

// POST /api/roadmap
router.post('/roadmap', async (req, res) => {
  const { career, verdict } = req.body;
  if (!career) return res.status(400).json({ error: 'Мамандық атауы жоқ' });

  try {
    const prompt = `Мен "${career}" мамандығын таңдағым келеді.${verdict ? ' Себебі: ' + verdict : ''}
Тек таза JSON қайтар:
{"summary":"1-2 сөйлем қазақша","steps":[{"title":"Қадам атауы","description":"2-3 сөйлем қазақша","skills":["Дағды1","Дағды2"]}]}
5-7 қадам, барлығы қазақша.`;

    const text = await askGroq(prompt);
    res.json(parseJSON(text));
  } catch {
    res.json({
      summary: `${career} мамандығына жету үшін жүйелі оқу қажет.`,
      steps: [
        { title: '1. Негіздерді үйрену',  description: 'Базалық білімді игеру.',   skills: ['Теория', 'Онлайн курс'] },
        { title: '2. Тәжірибе жасау',     description: 'Жобалар жасау.',           skills: ['Pet project', 'Портфолио'] },
        { title: '3. Жұмысқа кіру',       description: 'Резюме жазу, сұхбат.',     skills: ['Резюме', 'LinkedIn'] },
      ],
    });
  }
});

module.exports = router;
