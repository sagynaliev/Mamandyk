const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user:     process.env.DB_USER     || 'postgres',
  host:     process.env.DB_HOST     || 'localhost',
  database: process.env.DB_NAME     || 'mamandyk_db',
  password: process.env.DB_PASSWORD || '',
  port:     parseInt(process.env.DB_PORT) || 5432,
});

let dbOK = false;

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name  VARCHAR(100) NOT NULL,
      email      VARCHAR(200) UNIQUE NOT NULL,
      password   VARCHAR(200) NOT NULL,
      school     VARCHAR(200),
      role       VARCHAR(20) DEFAULT 'student'
                 CHECK (role IN ('student','manager','admin','mentor')),
      is_banned  BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS questions (
      question_id   SERIAL PRIMARY KEY,
      question_text TEXT NOT NULL,
      category      VARCHAR(100),
      created_at    TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS test_results (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      answers     JSONB NOT NULL,
      insight     TEXT,
      personality JSONB,
      careers     JSONB,
      created_at  TIMESTAMP DEFAULT NOW()
    );
  `);

  // Ескі схемадан жаңартуға арналған migration
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
  `).catch(() => {});

  // mentor constraint migration
  await pool.query(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('student','manager','admin','mentor'));
  `).catch(() => {});

  // Сұрақтарды seed
  const { rows } = await pool.query('SELECT COUNT(*) FROM questions');
  if (parseInt(rows[0].count) === 0) {
    const questions = [
      ['Мен командамен жұмыс істегенді ұнатамын',        'social'],
      ['Маған нақты есептерді шешу қызық',               'analytical'],
      ['Шығармашылық жұмыс маған рахат береді',          'creative'],
      ['Жаңа адамдармен танысуды жақсы көремін',         'social'],
      ['Аналитикалық ойлау — менің күшті жағым',         'analytical'],
      ['Техникалық жабдықтармен жұмыс істеуді ұнатамын', 'technical'],
      ['Әдебиет пен өнер маған жақын',                   'creative'],
      ['Басшылық ету рөлі маған сәйкес',                 'leadership'],
      ['Тәжірибелік жұмыс теориядан маңыздырақ',         'practical'],
      ['Ғылымды зерттеу — менің арманым',                'analytical'],
      ['Адамдарға көмек беру — маған мәнді',             'social'],
      ['Жоба жоспарлауды жақсы көремін',                 'leadership'],
      ['Деректермен жұмыс істеуді ұнатамын',             'analytical'],
      ['Табиғат пен экология мені қызықтырады',          'science'],
      ['Экономика мен бизнес маған жақын',               'business'],
      ['Спорт пен физикалық белсенділік маңызды',        'physical'],
      ['Тарих пен мәдениетті зерттеуді ұнатамын',        'humanities'],
      ['Заң мен қоғамдық тәртіп маңызды',               'legal'],
      ['Медицина мен денсаулық саласы маған қызық',      'medical'],
      ['Инновация мен стартап идеялары мені шабыттандырады', 'business'],
    ];
    for (const [text, category] of questions) {
      await pool.query(
        'INSERT INTO questions(question_text, category) VALUES($1,$2)',
        [text, category]
      );
    }
    console.log('✅ 20 сұрақ қосылды');
  }

  // Default admin
  const admins = await pool.query("SELECT id FROM users WHERE role='admin'");
  if (admins.rows.length === 0) {
    const bcrypt = require('bcryptjs');
    const hash   = await bcrypt.hash('admin123', 12);
    await pool.query(
      "INSERT INTO users(first_name,last_name,email,password,role) VALUES($1,$2,$3,$4,'admin') ON CONFLICT(email) DO NOTHING",
      ['Admin', 'Mamandyk', 'admin@mamandyk.kz', hash]
    );
    console.log('✅ Default admin: admin@mamandyk.kz / admin123');
  }
}

pool.connect()
  .then(async (client) => {
    dbOK = true;
    client.release();
    await initDB();
    console.log('✅ PostgreSQL қосылды —', process.env.DB_NAME || 'mamandyk_db');
  })
  .catch((e) => {
    console.error('❌ PostgreSQL қосылмады:', e.message);
  });

module.exports = { pool, get dbOK() { return dbOK; } };
