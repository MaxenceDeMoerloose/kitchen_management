import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/:monday", (req, res) => {
  const row = db.prepare("SELECT done, done_at, done_by FROM shopping_status WHERE monday = ?").get(
    req.params.monday
  );
  res.json(row ? { done: !!row.done, doneAt: row.done_at, doneBy: row.done_by } : { done: false, doneAt: null, doneBy: null });
});

router.put("/:monday", (req, res) => {
  const { done, doneAt, doneBy } = req.body;
  db.prepare(
    `INSERT INTO shopping_status (monday, done, done_at, done_by) VALUES (?, ?, ?, ?)
     ON CONFLICT(monday) DO UPDATE SET done = excluded.done, done_at = excluded.done_at, done_by = excluded.done_by`
  ).run(req.params.monday, done ? 1 : 0, doneAt || null, doneBy || null);
  res.json({ ok: true });
});

export default router;
