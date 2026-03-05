# 🚀 Mamandyk — Толық жүйе нұсқаулығы

> AI-мен жұмыс істейтін кәсіби бейімділік платформасы (Қазақстан студенттеріне арналған)

---

## 📁 Файл құрылымы

```
mamandyk/
│
├── frontend/               ← Барлық HTML беттер (браузерде ашылады)
│   ├── index.html          ← Басты бет + Тест
│   ├── about.html          ← Тест туралы анықтама беті
│   ├── careers.html        ← Пайдаланушының мамандықтары + AI Roadmap
│   ├── help.html           ← Тех қолдау / байланыс беті
│   ├── login.html          ← Кіру беті
│   ├── register.html       ← Тіркелу беті
│   ├── profile.html        ← Жеке профиль + тест тарихы
│   └── results.html        ← AI нәтижелер беті
│
├── backend/                ← Node.js сервері
│   ├── index.js            ← Барлық API (Express + PostgreSQL + Gemini AI)
│   ├── package.json        ← Тәуелділіктер
│   └── .env                ← Конфигурация (ТӨМЕНДЕ КӨРУ)
│
└── README.md               ← Осы файл
```

---

## ⚙️ Backend орнату

### 1. Тәуелділіктерді орнату
```bash
cd backend
npm install
```

Орнатылатын пакеттер:
| Пакет | Не үшін |
|-------|---------|
| `express` | Web сервер |
| `pg` | PostgreSQL |
| `bcryptjs` | Пароль шифрлау |
| `jsonwebtoken` | JWT аутентификация |
| `@google/generative-ai` | Gemini AI |
| `cors` | CORS |
| `dotenv` | ENV конфиг |

---

### 2. `.env` файлын жасау
`backend/` папкасына `.env` файлын жасап, мынаны толтыр:

```env
DB_USER=postgres
DB_PASSWORD=alikhan07
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mamandyk_db
PORT=5000

GEMINI_API_KEY=AIzaSyDi9KcSODVSc7xS1g3gHefTb1CBI9HXmWk

JWT_SECRET=mamandyk_super_secret_key_2025
```

---

### 3. PostgreSQL дерекқорын жасау
```sql
-- pgAdmin немесе psql-де:
CREATE DATABASE mamandyk_db;
```

> ✅ Кестелер (`users`, `questions`, `test_results`) сервер іске қосылғанда **автоматты** жасалады!

---

### 4. Серверді іске қосу
```bash
cd backend
node index.js
```

Немесе dev режимінде (nodemon):
```bash
npm run dev
```

Сәтті іске қосылса:
```
✅ PostgreSQL қосылды
✅ 20 demo сұрақ қосылды
✅ DB кестелері дайын
🚀 Mamandyk backend http://localhost:5000
```

---

## 🌐 Frontend іске қосу

### Нұсқа 1: Тікелей браузерде ашу
`frontend/index.html` файлын браузерде ашсаң болды.

### Нұсқа 2: Live Server (VS Code)
VS Code-та `Live Server` расширениесін орнатып, `index.html`-ді тінтуірдің оң жақ батырмасымен → `Open with Live Server`

### Нұсқа 3: Python HTTP server
```bash
cd frontend
python3 -m http.server 3000
# Браузерде: http://localhost:3000
```

---

## 🔗 Беттер арасындағы байланыс

```
index.html (Тест)
    ↓ Тапсырылды
results.html (AI нәтиже)
    ↓ localStorage-ге мамандықтар сақталды
careers.html (Roadmap)
    ↓ Мамандықты басты
[Modal: AI Roadmap — /api/roadmap]

Тіркелген пайдаланушы үшін:
register.html → login.html → profile.html
    ↑                              ↓
    └──── Тест нәтижелері DB-ге сақталады
```

---

## 📡 API Endpoints

| Метод | URL | Аутентификация | Сипаттама |
|-------|-----|----------------|-----------|
| GET | `/api/health` | Жоқ | Сервер статусы |
| POST | `/api/auth/register` | Жоқ | Тіркелу |
| POST | `/api/auth/login` | Жоқ | Кіру |
| PUT | `/api/auth/profile` | Bearer Token | Профиль жаңарту |
| GET | `/api/questions` | Жоқ | Тест сұрақтары |
| POST | `/api/get-ai-verdict` | Bearer Token (міндетті емес) | AI талдау + DB-ге сақтау |
| GET | `/api/results/my` | Bearer Token | Менің нәтижелерім |
| GET | `/api/results/:id` | Bearer Token | Жеке нәтиже |
| POST | `/api/roadmap` | Жоқ | Мамандық Roadmap (AI) |

---

## 🗺️ Навигация (Header)

| Сілтеме | Бет | Не бар? |
|---------|-----|---------|
| **Тест туралы** | `about.html` | Тест туралы анықтама, FAQ, шкала |
| **Мамандықтар** | `careers.html` | Тест нәтижесіндегі мамандықтар + AI Roadmap модалы |
| **Көмек** | `help.html` | Telegram, WhatsApp, Instagram, Email, хабарлама формасы |

---

## 🎨 Дизайн жүйесі

| Айнымалы | Мән | Қолдану |
|----------|-----|---------|
| `--green` | `#22c55e` | Батырмалар, акценттер |
| `--green-dark` | `#16a34a` | Hover күйлері |
| `--green-light` | `#f0fdf4` | Фон акценттері |
| `--bg` | `#f8fafc` | Бет фоны |
| `--text` | `#0f172a` | Негізгі мәтін |

Қаріптер: **Unbounded** (тақырыптар) + **Nunito** (мәтін)

---

## 🔒 Аутентификация жұмысы

1. Пайдаланушы тіркеледі → JWT Token алады → `localStorage`-де сақталады
2. Тест тапсырады → `results.html` Token-ді header-ге қосады
3. Backend Token-ді тексеріп, нәтижені `test_results` кестесіне сақтайды
4. `profile.html` → `/api/results/my` арқылы барлық тест тарихын шығарады
5. `careers.html` → соңғы нәтиженің мамандықтарын шығарады + AI Roadmap

---

## ✏️ Конфигурация өзгерту

### Байланыс мәліметтерін өзгерту (`help.html`)
```html
<!-- Telegram -->
<a href="https://t.me/СЕНІҢ_USERNAME">

<!-- WhatsApp -->
<a href="https://wa.me/ТЕЛЕФОН_НӨМІРІ">
  +7 XXX XXX XX XX

<!-- Instagram -->
<a href="https://instagram.com/АККАУНТ_АТЫ">
  @аккаунт.аты

<!-- Email -->
<a href="mailto:ПОЧТА@ДОМЕН.com">
```

### API адресін өзгерту
Барлық HTML файлдарда `http://localhost:5000` → өндірістік URL:
```javascript
const API = 'https://api.mamandyk.kz'; // немесе сенің серверің
```

---

## 🐛 Жиі кездесетін қателер

| Қате | Себеп | Шешім |
|------|-------|-------|
| `PostgreSQL жоқ` | DB қосылмады | pgAdmin-де DB қосыңыз |
| `AI қатесі` | API key дұрыс емес | `.env`-де GEMINI_API_KEY тексер |
| `CORS error` | Backend іске қосылмады | `node index.js` іске қос |
| `Token жарамсыз` | Token ескірді | Қайта кіру (logout → login) |

---

## 📦 Технологиялар

**Backend:** Node.js, Express, PostgreSQL, bcryptjs, JWT, Google Gemini AI  
**Frontend:** Vanilla HTML/CSS/JS, Google Fonts (Unbounded + Nunito)  
**Auth:** JWT (30 күн), bcrypt (12 rounds)  
**AI:** Google Gemini 2.0 Flash

---

*Жасаған: Mamandyk жобасы — Қазақстан студенттеріне арналған AI мансап кеңесші*
