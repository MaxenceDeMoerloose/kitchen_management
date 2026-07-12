import { Router } from "express";
import db from "../db.js";

const router = Router();

function mapRow(r) {
  return {
    id: r.id,
    label: r.label,
    startDate: r.start_date,
    startMeal: r.start_meal,
    endDate: r.end_date,
    endMeal: r.end_meal,
    adults: r.adults,
    children: r.children,
  };
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM periods ORDER BY start_date ASC, created_at ASC").all();
  res.json(rows.map(mapRow));
});

router.post("/", (req, res) => {
  const { id, label, startDate, startMeal, endDate, endMeal, adults, children } = req.body;
  db.prepare(
    `INSERT INTO periods (id, label, start_date, start_meal, end_date, end_meal, adults, children, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    label || "",
    startDate,
    startMeal,
    endDate,
    endMeal,
    Math.max(0, Number(adults) || 0),
    Math.max(0, Number(children) || 0),
    Date.now()
  );
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM periods WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
