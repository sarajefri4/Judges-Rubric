require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path    = require('path');
const db      = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'datathon-judging-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    maxAge:   24 * 60 * 60 * 1000, // 24 h
    httpOnly: true,
    sameSite: 'strict',
  },
}));

// ── Static assets ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/admin',  require('./routes/admin'));
app.use('/api/scores', require('./routes/scores'));

// Public lookups (no auth required)
app.get('/api/days', async (req, res) => {
  try {
    res.json(await db.all('SELECT * FROM days ORDER BY id'));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/days/:dayId/teams', async (req, res) => {
  try {
    res.json(await db.all('SELECT * FROM teams WHERE day_id = ? ORDER BY id', [req.params.dayId]));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/days/:dayId/judges', async (req, res) => {
  try {
    // Never expose pin_hash
    res.json(await db.all('SELECT id, name FROM judges WHERE day_id = ? ORDER BY id', [req.params.dayId]));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── HTML page routes ─────────────────────────────────────────────────────────
const htmlDir = path.join(__dirname, 'public');

// Prevent browsers from caching HTML so JS/CSS updates take effect immediately
function sendHtml(file) {
  return (_, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(htmlDir, file));
  };
}

app.get('/',                sendHtml('index.html'));
app.get('/admin-setup',     sendHtml('admin-setup.html'));
app.get('/admin-dashboard', sendHtml('admin-dashboard.html'));
app.get('/judge-login',     sendHtml('judge-login.html'));
app.get('/score',           sendHtml('score.html'));

// Form-based judge auth — sets session and redirects in one response
// (avoids iOS Safari cookie-timing issues with AJAX + client-side redirect)
app.post('/judge-auth', async (req, res) => {
  const judgeId = parseInt(req.body.judgeId, 10);
  if (!judgeId) return res.redirect('/judge-login?err=1');
  try {
    const judge = await db.get('SELECT * FROM judges WHERE id = ?', [judgeId]);
    if (!judge) return res.redirect('/judge-login?err=2');
    req.session.judgeId   = judge.id;
    req.session.judgeName = judge.name;
    req.session.dayId     = judge.day_id;
    req.session.save(err => {
      if (err) return res.redirect('/judge-login?err=3');
      res.redirect('/score');
    });
  } catch (err) {
    console.error(err);
    res.redirect('/judge-login?err=4');
  }
});
// Case-insensitive fallback — redirect /Score → /score
app.get('/Score',           (_, res) => res.redirect(301, '/score'));

// ── Start (wait for DB init) ─────────────────────────────────────────────────
db._ready.then(() => {
  app.listen(PORT, () => {
    console.log(`\n  Datathon Judging App`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  Local:     http://localhost:${PORT}`);
    console.log(`  Admin PIN: ${process.env.ADMIN_PIN || '(not set — check .env)'}`);
    console.log(`\n  → Open in browser or share your LAN IP with judges\n`);
  });
});
