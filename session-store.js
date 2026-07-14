/**
 * SQLite-backed session store for express-session.
 * Keeps sessions alive across server restarts.
 */
const { Store } = require('express-session');
const db = require('./db');

class SQLiteStore extends Store {
  get(sid, cb) {
    db.get('SELECT sess FROM sessions WHERE sid = ? AND expire > ?', [sid, Date.now()])
      .then(row => cb(null, row ? JSON.parse(row.sess) : null))
      .catch(cb);
  }

  set(sid, sess, cb) {
    const maxAge = sess.cookie?.maxAge ?? 86_400_000;
    const expire = Date.now() + maxAge;
    db.run(
      `INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire`,
      [sid, JSON.stringify(sess), expire]
    ).then(() => cb(null)).catch(cb);
  }

  destroy(sid, cb) {
    db.run('DELETE FROM sessions WHERE sid = ?', [sid])
      .then(() => cb(null)).catch(cb);
  }

  touch(sid, sess, cb) {
    const maxAge = sess.cookie?.maxAge ?? 86_400_000;
    const expire = Date.now() + maxAge;
    db.run('UPDATE sessions SET expire = ? WHERE sid = ?', [expire, sid])
      .then(() => cb(null)).catch(cb);
  }
}

module.exports = SQLiteStore;
