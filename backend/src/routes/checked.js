import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/:monday", (req, res) => {
  const row = db.prepare("SELECT data FROM checked WHERE monday = ?").get(req.params.monday);
  res.json(row ? JSON.parse(row.data) : {});
});

router.put("/:monday", (req, res) => {
  db.prepare(
    `INSERT INTO checked (monday, data) VALUES (?, ?)
     ON CONFLICT(monday) DO UPDATE SET data = excluded.data`
  ).run(req.params.monday, JSON.stringify(req.body));
  res.json({ ok: true });
});

export default router;
