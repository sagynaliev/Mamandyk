const { Pool } = require('pg');
require('dotenv').config();

// Render-де DATABASE_URL болады, локалкада DB_USER, DB_HOST т.б. қолданылады
const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'mamandyk_db'}`,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

let dbOK = false;

async function initDB() {
  try {
    // 1. Кестелерді құру
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        first_name  VARCHAR(100) NOT NULL,
        last_name   VARCHAR(100) NOT NULL,
        email       VARCHAR(200) UNIQUE NOT NULL,
        password    VARCHAR(200) NOT NULL,
        school      VARCHAR(200),
        role        VARCHAR(20) DEFAULT 'student' 
                    CHECK (role IN ('student','manager','admin','mentor')),
        is_banned   BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMP DEFAULT NOW()
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

    // 2. Migration: Ескі кестелерге бағандар қосу
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
    `).catch(() => {});

    // 3. Сұрақтарды seed (Тек база бос болса ғана)
    const { rows } = await pool.query('SELECT COUNT(*) FROM questions');
    if (parseInt(rows[0].count) === 0) {
      const questions = [
        ['Мен командамен жұмыс істегенді ұнатамын', 'social'],
        ['Маған нақты есептерді шешу қызық', 'analytical'],
        ['Шығармашылық жұмыс маған рахат береді', 'creative'],
        ['Жаңа адамдармен танысуды жақсы көремін', 'social'],
        ['Аналитикалық ойлау — менің күшті жағым', 'analytical']
        // ... басқа сұрақтарды осы жерде қалдыра бер
      ];
      for (const [text, category] of questions) {
        await pool.query('INSERT INTO questions(question_text, category) VALUES($1,$2)', [text, category]);
      }
      console.log('✅ База сұрақтармен толтырылды');
    }

    // 4. Default Admin
    const admins = await pool.query("SELECT id FROM users WHERE role='admin'");
    if (admins.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('admin123', 12);
      await pool.query(
        "INSERT INTO users(first_name,last_name,email,password,role) VALUES($1,$2,$3,$4,'admin') ON CONFLICT(email) DO NOTHING",
        ['Admin', 'Mamandyk', 'admin@mamandyk.kz', hash]
      );
      console.log('✅ Default admin құрылды: admin@mamandyk.kz');
    }
  } catch (err) {
    console.error('❌ initDB қатесі:', err.message);
  }
}

pool.connect()
  .then(async (client) => {
    dbOK = true;
    client.release();
    await initDB();
    console.log('✅ PostgreSQL қосылды');
  })
  .catch((e) => {
    console.error('❌ PostgreSQL қосылмады:', e.message);
  });

module.exports = { pool, get dbOK() { return dbOK; } };
