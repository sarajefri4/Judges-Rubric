/**
 * SQLite database layer using the `sqlite3` package.
 * Provides a thin promise wrapper so routes can use async/await.
 */

const DEFAULT_RUBRIC = [
  {
    key: 'impact', label: 'Business Impact', weight: 30,
    desc: 'How meaningful, actionable, and relevant is the insight drawn from the data?',
    subPoints: ['Addresses a real business problem', 'Recommendation is actionable by decision-makers'],
    ratings: ['No clear business value', 'Minimal business relevance', 'Moderate impact', 'Strong, actionable insight', 'Exceptional, transformative value']
  },
  {
    key: 'analysis', label: 'Quality of Analysis', weight: 25,
    desc: 'How effectively was the data explored and leveraged using Sigma to derive the insight?',
    subPoints: ['Depth and rigor of data exploration', 'Effective use of analytical tools'],
    ratings: ['Very superficial analysis', 'Basic data review', 'Solid analytical approach', 'Thorough and methodical analysis', 'Exceptional analytical depth']
  },
  {
    key: 'story', label: 'Storytelling', weight: 30,
    desc: 'How clearly and compellingly is the insight communicated?',
    subPoints: ['Clarity and structure of the narrative', 'Visual design and presentation quality'],
    ratings: ['Unclear or confusing', 'Basic communication', 'Clear and organized', 'Engaging and well-structured', 'Exceptional, compelling narrative']
  },
  {
    key: 'feasibility', label: 'Feasibility', weight: 15,
    desc: 'Can this insight realistically be acted upon, and does the team understand its implications?',
    subPoints: ['Realistic path to implementation', 'Team understands constraints and trade-offs'],
    ratings: ['Not feasible', 'Limited considerations', 'Generally feasible', 'Well-thought-out path', 'Highly feasible with clear next steps']
  }
];

const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const fs      = require('fs');

const DB_DIR  = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'judging.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const rawDb = new sqlite3.Database(DB_PATH, err => {
  if (err) { console.error('DB open error:', err); process.exit(1); }
});

/* ── Promise helpers ─────────────────────────────────────────────────────── */
const db = {
  /** Execute a statement with no return value. */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      rawDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  /** Return first matching row or undefined. */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      rawDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /** Return all matching rows. */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      rawDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  /** Execute multiple statements (no params). */
  exec(sql) {
    return new Promise((resolve, reject) => {
      rawDb.exec(sql, err => { if (err) reject(err); else resolve(); });
    });
  },

  /** Run statements inside a serialized block — emulates a transaction. */
  async transaction(fn) {
    await db.run('BEGIN');
    try {
      await fn();
      await db.run('COMMIT');
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  },
};

/* ── Schema init (runs once on startup) ─────────────────────────────────── */
async function initSchema() {
  await db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid    TEXT PRIMARY KEY,
      sess   TEXT NOT NULL,
      expire INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS days (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teams (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      name   TEXT    NOT NULL,
      day_id INTEGER NOT NULL,
      FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS judges (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT    NOT NULL,
      day_id   INTEGER NOT NULL,
      pin_hash TEXT,
      FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scores (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      judge_id     INTEGER NOT NULL,
      team_id      INTEGER NOT NULL,
      impact       REAL    NOT NULL DEFAULT 0,
      analysis     REAL    NOT NULL DEFAULT 0,
      story        REAL    NOT NULL DEFAULT 0,
      feasibility  REAL    NOT NULL DEFAULT 0,
      total        REAL    NOT NULL DEFAULT 0,
      notes        TEXT             DEFAULT '',
      submitted_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(judge_id, team_id),
      FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id)  REFERENCES teams(id)  ON DELETE CASCADE
    );
  `);

  // Seed default days if none exist
  const days = await db.all('SELECT id FROM days ORDER BY id');
  if (days.length === 0) {
    await db.run("INSERT INTO days (name, date) VALUES ('Day 1', 'April 20')");
    await db.run("INSERT INTO days (name, date) VALUES ('Day 2', 'April 21')");
  }

  // Seed config defaults
  await db.run("INSERT OR IGNORE INTO config (key, value) VALUES ('event_name', 'DATATHON')");
  await db.run("INSERT OR IGNORE INTO config (key, value) VALUES ('theme', 'green')");
  await db.run("INSERT OR IGNORE INTO config (key, value) VALUES ('rubric', ?)", [JSON.stringify(DEFAULT_RUBRIC)]);
}

/* Export the db object and the init promise so server.js can await startup. */
db._ready = initSchema().catch(err => {
  console.error('DB init error:', err);
  process.exit(1);
});

module.exports = db;
module.exports.DEFAULT_RUBRIC = DEFAULT_RUBRIC;
