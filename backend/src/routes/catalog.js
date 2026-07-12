import { Router } from "express";
import db from "../db.js";
import CATALOG from "../catalog.js";

const router = Router();

router.get("/", (req, res) => {
  const custom = db.prepare("SELECT nom, categorie, emoji, unite, prix_moyen_eur, base_par_portion FROM custom_catalog ORDER BY created_at ASC").all();
  res.json([...CATALOG, ...custom]);
});

router.post("/", (req, res) => {
  const { nom, categorie, emoji, unite, prix_moyen_eur, base_par_portion } = req.body;
  if (!nom || !nom.trim() || !categorie || !unite) return res.status(400).json({ error: "invalid payload" });
  const price = Math.max(0, Number(prix_moyen_eur) || 0);
  const basePortion = Math.max(0, Number(base_par_portion) || 0);
  db.prepare(
    `INSERT INTO custom_catalog (nom, categorie, emoji, unite, prix_moyen_eur, base_par_portion, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(nom) DO UPDATE SET categorie = excluded.categorie, emoji = excluded.emoji, unite = excluded.unite,
       prix_moyen_eur = excluded.prix_moyen_eur, base_par_portion = excluded.base_par_portion`
  ).run(nom.trim(), categorie, emoji?.trim() || "🛒", unite, price, basePortion, Date.now());
  res.json({ nom: nom.trim(), categorie, emoji: emoji?.trim() || "🛒", unite, prix_moyen_eur: price, base_par_portion: basePortion });
});

export default router;
