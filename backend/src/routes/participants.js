import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  res.json(db.prepare("SELECT id, name FROM participants ORDER BY created_at ASC").all());
});

router.post("/", (req, res) => {
  const { id, name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "invalid payload" });
  db.prepare("INSERT INTO participants (id, name, created_at) VALUES (?, ?, ?)").run(id, name.trim(), Date.now());
  res.json({ id, name: name.trim() });
});

router.put("/:id", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "invalid payload" });
  db.prepare("UPDATE participants SET name = ? WHERE id = ?").run(name.trim(), req.params.id);
  res.json({ id: req.params.id, name: name.trim() });
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM participants WHERE id = ?").run(req.params.id);
  db.prepare("DELETE FROM receipt_shares WHERE participant_id = ?").run(req.params.id);
  db.prepare("UPDATE receipts SET paid_by = NULL WHERE paid_by = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
