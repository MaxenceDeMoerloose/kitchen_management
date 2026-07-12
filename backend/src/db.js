import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "app.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS weeks (
    monday TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS checked (
    monday TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pricedb (
    name TEXT PRIMARY KEY,
    price REAL NOT NULL,
    unit TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS library (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mealType TEXT NOT NULL,
    desc TEXT NOT NULL,
    items TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS favs (
    name TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    adults INTEGER NOT NULL,
    children INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS shopping_status (
    monday TEXT PRIMARY KEY,
    done INTEGER NOT NULL DEFAULT 0,
    done_at TEXT,
    done_by TEXT
  );
`);

const hasProfile = db.prepare("SELECT 1 FROM profile WHERE id = 1").get();
if (!hasProfile) {
  db.prepare("INSERT INTO profile (id, adults, children) VALUES (1, 2, 0)").run();
}

export default db;
