const router = require('express').Router();
const { askGroq, parseJSON } = require('../services/groq');

// POST /api/simulator/tasks
router.post('/tasks', async (req, res) => {
  const { career } = req.body;
  if (!career) return res.status(400).json({ error: 'Мамандық атауы жоқ' });

  try {
    console.log('🎮 Simulator:', career);
    const prompt = `"${career}" мамандығы бойынша 5 тапсырма жаса. 3 таңдамалы + 2 ашық.
Тек таза JSON қайтар:
{"tasks":[{"type":"choice","question":"Сұрақ қазақша","hint":"Кеңес","options":["A","B","C","D"],"correct":0,"explain":"Түсіндірме"},{"type":"text","question":"Ашық сұрақ","hint":"Кеңес","explain":"Үлгі жауап"}]}
Тапсырмалар нақты ${career} жұмысына байланысты болсын. Барлығы қазақша.`;

    const text = await askGroq(prompt, 2048);
    res.json(parseJSON(text));
  } catch (e) {
    console.error('❌ Simulator:', e.message);
    res.status(500).json({ error: 'AI тапсырма жасай алмады: ' + e.message });
  }
});

module.exports = router;
