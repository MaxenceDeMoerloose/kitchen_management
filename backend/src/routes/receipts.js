import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import db, { receiptsDir } from "../db.js";
import { saveViewableImage, preprocessForOcr, extractText } from "../ocr/runOcr.js";
import { parseReceipt } from "../ocr/colruytParser.js";
import { extractReceiptWithAI, isOpenRouterEnabled } from "../ocr/openrouter.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// OCR local (Tesseract + parseur regex) : gratuit et sans configuration, mais moins précis.
async function scanWithTesseract(buffer, ocrTmpPath) {
  await preprocessForOcr(buffer, ocrTmpPath);
  const rawText = await extractText(ocrTmpPath);
  return { ...parseReceipt(rawText), engine: "tesseract" };
}

// Analyse un ticket : sauvegarde la photo, extrait les articles, renvoie un brouillon
// (rien n'est encore enregistré en tant que dépense — la validation se fait ensuite via
// POST /api/receipts). Utilise le modèle Vision d'OpenRouter si une clé API est
// configurée, avec repli automatique sur l'OCR local en cas d'échec ou de quota atteint.
router.post("/scan", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no image" });
  const id = crypto.randomUUID();
  const imageFilename = `${id}.jpg`;
  const imagePath = path.join(receiptsDir, imageFilename);
  const ocrTmpPath = path.join(receiptsDir, `${id}-ocr.png`);
  try {
    await saveViewableImage(req.file.buffer, imagePath);

    let parsed;
    if (isOpenRouterEnabled()) {
      try {
        parsed = { ...(await extractReceiptWithAI(req.file.buffer)), engine: "openrouter" };
      } catch (err) {
        console.error("OpenRouter a échoué, repli sur l'OCR local:", err.message);
        parsed = await scanWithTesseract(req.file.buffer, ocrTmpPath);
      }
    } else {
      parsed = await scanWithTesseract(req.file.buffer, ocrTmpPath);
    }

    res.json({ imageFilename, ...parsed });
  } catch (err) {
    console.error("Erreur d'analyse du ticket:", err);
    res.status(500).json({ error: "ocr_failed" });
  } finally {
    fs.rm(ocrTmpPath, { force: true }, () => {});
  }
});

router.get("/image/:filename", (req, res) => {
  const filePath = path.join(receiptsDir, req.params.filename);
  if (!filePath.startsWith(receiptsDir) || !fs.existsSync(filePath)) return res.status(404).end();
  res.sendFile(filePath);
});

function mapReceipt(row) {
  const items = db
    .prepare("SELECT id, name, qty, unit, unit_price, total_price FROM receipt_items WHERE receipt_id = ?")
    .all(row.id)
    .map((it) => ({ id: it.id, name: it.name, qty: it.qty, unit: it.unit, unitPrice: it.unit_price, totalPrice: it.total_price }));
  const shares = db.prepare("SELECT participant_id FROM receipt_shares WHERE receipt_id = ?").all(row.id).map((s) => s.participant_id);
  return {
    id: row.id,
    store: row.store,
    purchaseDate: row.purchase_date,
    paidBy: row.paid_by,
    total: row.total,
    imageFilename: row.image_path,
    items,
    shares,
  };
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM receipts ORDER BY purchase_date DESC, created_at DESC").all();
  res.json(rows.map(mapReceipt));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM receipts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).end();
  res.json(mapReceipt(row));
});

const saveReceipt = db.transaction((id, body, isUpdate) => {
  const { store, purchaseDate, paidBy, total, imageFilename, rawText, items, shares } = body;
  if (isUpdate) {
    db.prepare(
      "UPDATE receipts SET store=?, purchase_date=?, paid_by=?, total=? WHERE id=?"
    ).run(store, purchaseDate, paidBy || null, total, id);
    db.prepare("DELETE FROM receipt_items WHERE receipt_id = ?").run(id);
    db.prepare("DELETE FROM receipt_shares WHERE receipt_id = ?").run(id);
  } else {
    db.prepare(
      "INSERT INTO receipts (id, store, purchase_date, paid_by, total, image_path, raw_ocr_text, created_at) VALUES (?,?,?,?,?,?,?,?)"
    ).run(id, store, purchaseDate, paidBy || null, total, imageFilename || null, rawText || null, Date.now());
  }
  const insertItem = db.prepare(
    "INSERT INTO receipt_items (id, receipt_id, name, qty, unit, unit_price, total_price) VALUES (?,?,?,?,?,?,?)"
  );
  for (const it of items || []) {
    insertItem.run(crypto.randomUUID(), id, it.name, it.qty, it.unit, it.unitPrice, it.totalPrice);
  }
  const insertShare = db.prepare("INSERT OR IGNORE INTO receipt_shares (receipt_id, participant_id) VALUES (?, ?)");
  for (const pid of shares || []) insertShare.run(id, pid);
});

router.post("/", (req, res) => {
  const id = crypto.randomUUID();
  saveReceipt(id, req.body, false);
  res.json(mapReceipt(db.prepare("SELECT * FROM receipts WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const exists = db.prepare("SELECT 1 FROM receipts WHERE id = ?").get(req.params.id);
  if (!exists) return res.status(404).end();
  saveReceipt(req.params.id, req.body, true);
  res.json(mapReceipt(db.prepare("SELECT * FROM receipts WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT image_path FROM receipts WHERE id = ?").get(req.params.id);
  db.prepare("DELETE FROM receipt_items WHERE receipt_id = ?").run(req.params.id);
  db.prepare("DELETE FROM receipt_shares WHERE receipt_id = ?").run(req.params.id);
  db.prepare("DELETE FROM receipts WHERE id = ?").run(req.params.id);
  if (row?.image_path) fs.rm(path.join(receiptsDir, row.image_path), { force: true }, () => {});
  res.json({ ok: true });
});

export default router;
