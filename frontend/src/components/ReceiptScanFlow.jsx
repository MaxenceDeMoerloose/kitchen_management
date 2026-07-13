import { useEffect, useRef, useState } from "react";
import { useApp } from "../store.jsx";
import ReceiptForm from "./ReceiptForm.jsx";
import { uid, num } from "../utils.js";

const LOADING_MESSAGES = ["Lecture du ticket…", "Extraction des articles…", "Vérification des totaux…"];

// Lignes d'un ticket qui ne désignent pas un produit : elles n'ont rien à faire dans la
// base de prix personnelle (on en a retrouvé, du type « remise — totale korting met xtra »).
const DISCOUNT_LINE = /(remise|korting|réduction|reduction|\bbon\b|voordeel|gratis|totaal|total\b|te betalen|à payer)/i;

const emptyDraft = (participants) => ({
  store: "Colruyt",
  purchaseDate: new Date().toISOString().slice(0, 10),
  items: [],
  total: 0,
  imageFilename: null,
  rawText: "",
  engine: null,
  model: null,
  paidBy: participants[0]?.id || "",
  shares: participants.map((p) => p.id),
});

export default function ReceiptScanFlow({ onClose }) {
  const { participants, scanReceipt, saveReceipt, rememberPrice, showToast } = useApp();
  const [step, setStep] = useState("upload"); // upload | loading | validate
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [draft, setDraft] = useState(null);
  const [syncPrices, setSyncPrices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (step !== "loading") return;
    setLoadingMsgIdx(0);
    const t = setInterval(() => setLoadingMsgIdx((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1)), 1300);
    return () => clearInterval(t);
  }, [step]);

  async function handleFile(file) {
    if (!file) return;
    setStep("loading");
    try {
      const result = await scanReceipt(file);
      setDraft({
        ...emptyDraft(participants),
        store: result.store || "Colruyt",
        purchaseDate: result.date || new Date().toISOString().slice(0, 10),
        items: (result.items || []).map((it) => ({ id: uid(), ...it })),
        total: result.total || 0,
        imageFilename: result.imageFilename,
        rawText: result.rawText || "",
        engine: result.engine || null,
        model: result.model || null,
      });
      if (result.engine === "tesseract") {
        showToast("L'IA n'était pas disponible — lecture par l'OCR local, vérifiez bien les lignes");
      }
      setStep("validate");
    } catch {
      showToast("Échec de l'analyse du ticket — saisissez-le manuellement");
      setDraft(emptyDraft(participants));
      setStep("validate");
    }
  }

  async function submit() {
    if (submitting) return;
    if (!draft.paidBy) return showToast("Choisissez qui a payé le ticket");
    if (draft.shares.length === 0) return showToast("Sélectionnez au moins un participant");
    setSubmitting(true);
    try {
      await saveReceipt({
        store: draft.store,
        purchaseDate: draft.purchaseDate,
        paidBy: draft.paidBy,
        total: num(draft.total),
        imageFilename: draft.imageFilename,
        rawText: draft.rawText,
        engine: draft.engine,
        model: draft.model,
        items: draft.items
          .filter((it) => it.name.trim())
          .map(({ name, qty, unit, unitPrice, totalPrice }) => ({
            name,
            qty: num(qty),
            unit,
            unitPrice: num(unitPrice),
            totalPrice: num(totalPrice),
          })),
        shares: draft.shares,
      });
      if (syncPrices) {
        // Une remise ou une ligne de total n'est pas un produit : l'enregistrer comme prix
        // de référence polluait la base et faussait les suggestions.
        for (const it of draft.items) {
          const name = it.name.trim();
          if (!name || DISCOUNT_LINE.test(name)) continue;
          if (num(it.totalPrice) <= 0 || num(it.unitPrice) <= 0) continue;
          rememberPrice(name, num(it.unitPrice), it.unit);
        }
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "upload") {
    return (
      <div className="card scan-upload">
        <h2>📷 Scanner un ticket</h2>
        <p className="catalog-note">
          Photo directe ou fichier existant. Fonctionne mieux sur une surface plane et bien éclairée, ticket
          entier dans le cadre.
        </p>
        <div className="scan-upload-actions">
          <button className="btn btn-primary" onClick={() => cameraInputRef.current?.click()}>
            📷 Prendre une photo
          </button>
          <button className="btn" onClick={() => fileInputRef.current?.click()}>
            🖼 Choisir un fichier
          </button>
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div className="card scan-loading">
        <div className="spinner" />
        <p>{LOADING_MESSAGES[loadingMsgIdx]}</p>
      </div>
    );
  }

  return (
    <div className="card scan-validate">
      <h2>Vérifier le ticket</h2>
      <ReceiptForm draft={draft} setDraft={setDraft} participants={participants} />

      <label className="scan-sync-price">
        <input type="checkbox" checked={syncPrices} onChange={(e) => setSyncPrices(e.target.checked)} />
        Mettre à jour la base de prix personnelle avec les prix de ce ticket
      </label>

      <div className="modal-footer">
        <button className="btn" onClick={onClose} disabled={submitting}>
          Annuler
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? "Enregistrement…" : "Enregistrer la dépense"}
        </button>
      </div>
    </div>
  );
}
