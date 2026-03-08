const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mamandyk_super_secret_key_2025';

// JWT токенін тексереді
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token жоқ' });
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token жарамсыз немесе мерзімі өткен' });
  }
}

// Рөл тексерісі — requireRole('admin', 'manager')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Қол жеткізу жоқ' });
    }
    next();
  };
}

// Input санитизациясы (XSS қорғанысы)
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>'"&]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;', '&': '&amp;',
  }[c]));
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

module.exports = { authMiddleware, requireRole, sanitize, signToken };
