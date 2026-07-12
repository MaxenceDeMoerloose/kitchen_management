import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT name FROM favs ORDER BY created_at DESC").all();
  res.json(rows.map((r) => r.name));
});

router.post("/toggle", (req, res) => {
  const { name } = req.body;
  const exists = db.prepare("SELECT 1 FROM favs WHERE name = ?").get(name);
  if (exists) db.prepare("DELETE FROM favs WHERE name = ?").run(name);
  else db.prepare("INSERT INTO favs (name, created_at) VALUES (?, ?)").run(name, Date.now());
  const rows = db.prepare("SELECT name FROM favs ORDER BY created_at DESC").all();
  res.json(rows.map((r) => r.name));
});

export default router;
