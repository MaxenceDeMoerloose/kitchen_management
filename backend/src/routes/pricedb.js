import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT name, price, unit FROM pricedb").all();
  const obj = {};
  for (const r of rows) obj[r.name] = { price: r.price, unit: r.unit };
  res.json(obj);
});

router.put("/", (req, res) => {
  const { name, price, unit } = req.body;
  if (!name || !(price > 0) || !unit) return res.status(400).json({ error: "invalid payload" });
  db.prepare(
    `INSERT INTO pricedb (name, price, unit) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET price = excluded.price, unit = excluded.unit`
  ).run(name, price, unit);
  res.json({ ok: true });
});

export default router;
