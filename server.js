require('dotenv').config();

const express      = require('express');
const session      = require('express-session');
const path         = require('path');
const db           = require('./db');
const SQLiteStore  = require('./session-store');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store:             new SQLiteStore(),
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

// Public settings endpoint (no auth required)
app.get('/api/settings', async (req, res) => {
  try {
    const { DEFAULT_RUBRIC } = require('./db');
    const rows = await db.all("SELECT key, value FROM config WHERE key IN ('event_name','theme','rubric')");
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({
      eventName: map.event_name || 'DATATHON',
      theme: map.theme || 'green',
      rubric: map.rubric ? JSON.parse(map.rubric) : DEFAULT_RUBRIC,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
