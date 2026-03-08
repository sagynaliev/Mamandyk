const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function askGroq(prompt, maxTokens = 2048) {
  const chat = await groq.chat.completions.create({
    model:       'llama-3.3-70b-versatile',
    messages:    [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens:  maxTokens,
  });
  return chat.choices[0]?.message?.content || '';
}

async function chatGroq(messages, maxTokens = 512) {
  const chat = await groq.chat.completions.create({
    model:       'llama-3.3-70b-versatile',
    messages:    messages.map(m => ({ role: m.role, content: m.content })),
    temperature: 0.75,
    max_tokens:  maxTokens,
  });
  return chat.choices[0]?.message?.content || '';
}

// JSON parse helper — Groq жауабынан JSON бөлігін алады
function parseJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI жауабында JSON жоқ');
  return JSON.parse(match[0]);
}

// Тест нәтижесі үшін fallback (Groq жауап бермесе)
function fallbackVerdict() {
  return {
    insight: 'Сіздің жауаптарыңыз аналитикалық қабілеттіліктің жоғары деңгейін көрсетеді.',
    personality: [
      { left: 'Аналитика',   leftVal: 68, right: 'Шығармашылық', rightVal: 32 },
      { left: 'Интроверт',   leftVal: 45, right: 'Экстраверт',   rightVal: 55 },
      { left: 'Теория',      leftVal: 40, right: 'Тәжірибе',     rightVal: 60 },
      { left: 'Тұрақтылық',  leftVal: 70, right: 'Икемділік',    rightVal: 30 },
    ],
    careers: [
      { title: 'Software Engineer', score: 94, verdict: 'Логикалық ойлауыңыз техникалық салада керемет.', salary: '500k–1.5M ₸', growth: 'Өте жоғары' },
      { title: 'Data Scientist',    score: 87, verdict: 'Деректер анализі — аналитикалық санаңызға сай.', salary: '600k–1.8M ₸', growth: 'Жоғары' },
      { title: 'Product Manager',   score: 79, verdict: 'Стратегиялық ойлауыңыз өнімді басқаруда тиімді.', salary: '400k–1.2M ₸', growth: 'Жоғары' },
    ],
  };
}

module.exports = { askGroq, chatGroq, parseJSON, fallbackVerdict };
