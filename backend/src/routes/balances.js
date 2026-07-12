import { Router } from "express";
import db from "../db.js";

const router = Router();

// Solde net par participant : ce qu'il a payé - sa part due sur les tickets où il est
// inclus (part = total du ticket / nombre de participants inclus sur ce ticket).
router.get("/", (req, res) => {
  const participants = db.prepare("SELECT id, name FROM participants ORDER BY created_at ASC").all();
  const receipts = db.prepare("SELECT id, paid_by, total FROM receipts").all();
  const sharesByReceipt = new Map();
  for (const row of db.prepare("SELECT receipt_id, participant_id FROM receipt_shares").all()) {
    if (!sharesByReceipt.has(row.receipt_id)) sharesByReceipt.set(row.receipt_id, []);
    sharesByReceipt.get(row.receipt_id).push(row.participant_id);
  }

  const balances = new Map(participants.map((p) => [p.id, { id: p.id, name: p.name, paid: 0, owed: 0 }]));

  for (const r of receipts) {
    if (r.paid_by && balances.has(r.paid_by)) balances.get(r.paid_by).paid += r.total;
    const shares = sharesByReceipt.get(r.id) || [];
    if (shares.length === 0) continue;
    const perPerson = r.total / shares.length;
    for (const pid of shares) {
      if (balances.has(pid)) balances.get(pid).owed += perPerson;
    }
  }

  const result = Array.from(balances.values()).map((b) => ({
    ...b,
    paid: Math.round(b.paid * 100) / 100,
    owed: Math.round(b.owed * 100) / 100,
    balance: Math.round((b.paid - b.owed) * 100) / 100,
  }));

  res.json(result);
});

export default router;
