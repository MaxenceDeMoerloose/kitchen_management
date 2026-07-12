import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const row = db.prepare("SELECT adults, children, child_factor FROM profile WHERE id = 1").get();
  res.json({ adults: row.adults, children: row.children, childFactor: row.child_factor });
});

router.put("/", (req, res) => {
  const adults = Math.max(0, Number(req.body.adults) || 0);
  const children = Math.max(0, Number(req.body.children) || 0);
  const childFactor = Math.min(2, Math.max(0, Number(req.body.childFactor) || 0));
  db.prepare("UPDATE profile SET adults = ?, children = ?, child_factor = ? WHERE id = 1").run(
    adults,
    children,
    childFactor
  );
  res.json({ adults, children, childFactor });
});

export default router;
