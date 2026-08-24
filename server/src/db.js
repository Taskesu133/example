import { createClient } from '@libsql/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localDbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');

// Ako su podesene Turso promenljive, koristi cloud bazu (trajno i besplatno,
// nezavisno od restarta servisa). Bez njih, radi lokalno preko fajla — korisno
// za razvoj na svom racunaru bez potrebe za Turso nalogom.
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${localDbPath}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// libSQL vraca INTEGER PRIMARY KEY (rowid) kolone kao BigInt, sto JSON.stringify
// ne ume da serijalizuje. Nasi id-jevi su mali (auto-increment), pa je bezbedno
// pretvoriti ih u obican Number.
function sanitizeRow(row) {
  if (!row) return row;
  const clean = {};
  for (const [key, value] of Object.entries(row)) {
    clean[key] = typeof value === 'bigint' ? Number(value) : value;
  }
  return clean;
}

export async function dbGet(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows[0] ? sanitizeRow(result.rows[0]) : null;
}

export async function dbAll(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows.map(sanitizeRow);
}

export async function dbRun(sql, args = []) {
  const result = await client.execute({ sql, args });
  return {
    lastInsertRowid: result.lastInsertRowid != null ? Number(result.lastInsertRowid) : null,
    changes: result.rowsAffected,
  };
}

export async function initDb() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      UNIQUE(group_id, name)
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      note TEXT,
      spent_on TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS budgets (
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      amount REAL NOT NULL,
      PRIMARY KEY (group_id, month)
    )`,
    `CREATE TABLE IF NOT EXISTS automation_state (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
  ];

  for (const sql of statements) {
    await client.execute(sql);
  }
}

const defaultCategories = [
  ['Hrana', '#f97316'],
  ['Stanovanje', '#6366f1'],
  ['Prevoz', '#0ea5e9'],
  ['Zabava', '#ec4899'],
  ['Zdravlje', '#10b981'],
  ['Racuni', '#eab308'],
  ['Ostalo', '#64748b'],
];

export async function seedDefaultCategories(groupId) {
  await client.batch(
    defaultCategories.map(([name, color]) => ({
      sql: 'INSERT OR IGNORE INTO categories (group_id, name, color) VALUES (?, ?, ?)',
      args: [groupId, name, color],
    })),
    'write'
  );
}

// Za slucajeve gde vise upisa mora biti atomski (npr. kreiranje grupe +
// clanstvo + podrazumevane kategorije). `fn` dobija { get, all, run } koji
// rade unutar iste transakcije.
export async function withTransaction(fn) {
  const tx = await client.transaction('write');
  try {
    const txGet = async (sql, args = []) => {
      const result = await tx.execute({ sql, args });
      return result.rows[0] ? sanitizeRow(result.rows[0]) : null;
    };
    const txAll = async (sql, args = []) => {
      const result = await tx.execute({ sql, args });
      return result.rows.map(sanitizeRow);
    };
    const txRun = async (sql, args = []) => {
      const result = await tx.execute({ sql, args });
      return {
        lastInsertRowid: result.lastInsertRowid != null ? Number(result.lastInsertRowid) : null,
        changes: result.rowsAffected,
      };
    };

    const value = await fn({ get: txGet, all: txAll, run: txRun });
    await tx.commit();
    return value;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function seedDefaultCategoriesTx(run, groupId) {
  for (const [name, color] of defaultCategories) {
    await run('INSERT OR IGNORE INTO categories (group_id, name, color) VALUES (?, ?, ?)', [
      groupId,
      name,
      color,
    ]);
  }
}

export async function getAutomationState(key) {
  const row = await dbGet('SELECT value FROM automation_state WHERE key = ?', [key]);
  return row ? row.value : null;
}

export async function setAutomationState(key, value) {
  await dbRun(
    `INSERT INTO automation_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}
