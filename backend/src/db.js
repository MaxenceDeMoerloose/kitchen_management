import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

export const receiptsDir = path.join(dataDir, "receipts");
fs.mkdirSync(receiptsDir, { recursive: true });

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
    children INTEGER NOT NULL,
    child_factor REAL NOT NULL DEFAULT 0.65
  );
  CREATE TABLE IF NOT EXISTS shopping_status (
    monday TEXT PRIMARY KEY,
    done INTEGER NOT NULL DEFAULT 0,
    done_at TEXT,
    done_by TEXT
  );
  CREATE TABLE IF NOT EXISTS custom_catalog (
    nom TEXT PRIMARY KEY,
    categorie TEXT NOT NULL,
    emoji TEXT NOT NULL,
    unite TEXT NOT NULL,
    prix_moyen_eur REAL NOT NULL,
    base_par_portion REAL NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS periods (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    start_date TEXT NOT NULL,
    start_meal TEXT NOT NULL,
    end_date TEXT NOT NULL,
    end_meal TEXT NOT NULL,
    adults INTEGER NOT NULL,
    children INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    store TEXT NOT NULL,
    purchase_date TEXT NOT NULL,
    paid_by TEXT,
    total REAL NOT NULL,
    image_path TEXT,
    raw_ocr_text TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS receipt_items (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL,
    name TEXT NOT NULL,
    qty REAL NOT NULL,
    unit TEXT NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS receipt_shares (
    receipt_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    PRIMARY KEY (receipt_id, participant_id)
  );
  CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON receipt_items(receipt_id);
  CREATE INDEX IF NOT EXISTS idx_receipt_shares_receipt ON receipt_shares(receipt_id);
`);

// Migration : les bases créées avant l'ajout du facteur enfant n'ont pas la colonne.
const profileCols = db.prepare("PRAGMA table_info(profile)").all().map((c) => c.name);
if (!profileCols.includes("child_factor")) {
  db.exec("ALTER TABLE profile ADD COLUMN child_factor REAL NOT NULL DEFAULT 0.65");
}

const hasProfile = db.prepare("SELECT 1 FROM profile WHERE id = 1").get();
if (!hasProfile) {
  db.prepare("INSERT INTO profile (id, adults, children, child_factor) VALUES (1, 2, 0, 0.65)").run();
}

export default db;
