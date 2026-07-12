import { Router } from "express";
import db from "../db.js";
import { MEALS } from "../constants.js";

const router = Router();

function emptyWeek() {
  const week = {};
  for (let d = 0; d < 7; d++) {
    week[d] = {};
    for (const m of MEALS) week[d][m.key] = { desc: "", items: [] };
  }
  return week;
}

router.get("/:monday", (req, res) => {
  const row = db.prepare("SELECT data FROM weeks WHERE monday = ?").get(req.params.monday);
  res.json(row ? JSON.parse(row.data) : emptyWeek());
});

router.put("/:monday", (req, res) => {
  db.prepare(
    `INSERT INTO weeks (monday, data) VALUES (?, ?)
     ON CONFLICT(monday) DO UPDATE SET data = excluded.data`
  ).run(req.params.monday, JSON.stringify(req.body));
  res.json({ ok: true });
});

export default router;
