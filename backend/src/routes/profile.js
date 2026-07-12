import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  res.json(db.prepare("SELECT adults, children FROM profile WHERE id = 1").get());
});

router.put("/", (req, res) => {
  const adults = Math.max(0, Number(req.body.adults) || 0);
  const children = Math.max(0, Number(req.body.children) || 0);
  db.prepare("UPDATE profile SET adults = ?, children = ? WHERE id = 1").run(adults, children);
  res.json({ adults, children });
});

export default router;
