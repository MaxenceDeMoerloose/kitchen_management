import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM library ORDER BY created_at DESC").all();
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      mealType: r.mealType,
      desc: r.desc,
      items: JSON.parse(r.items),
    }))
  );
});

router.post("/", (req, res) => {
  const { id, name, mealType, desc, items } = req.body;
  db.prepare(
    "INSERT INTO library (id, name, mealType, desc, items, created_at) VALUES (?,?,?,?,?,?)"
  ).run(id, name, mealType, desc, JSON.stringify(items), Date.now());
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM library WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
