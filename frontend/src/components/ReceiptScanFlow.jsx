import { useEffect, useRef, useState } from "react";
import { useApp } from "../store.jsx";
import { UNITS } from "../constants.js";
import { uid, money, normalize } from "../utils.js";

const LOADING_MESSAGES = ["Lecture du ticket…", "Extraction des articles…", "Finalisation…"];

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
        store: result.store || "Colruyt",
        purchaseDate: result.date || new Date().toISOString().slice(0, 10),
        items: (result.items || []).map((it) => ({ id: uid(), ...it })),
        total: result.total || 0,
        imageFilename: result.imageFilename,
        rawText: result.rawText || "",
        paidBy: participants[0]?.id || "",
        shares: participants.map((p) => p.id),
      });
      setStep("validate");
    } catch {
      showToast("Échec de l'analyse du ticket — réessayez ou saisissez-le manuellement");
      setDraft({
        store: "Colruyt",
        purchaseDate: new Date().toISOString().slice(0, 10),
        items: [],
        total: 0,
        imageFilename: null,
        rawText: "",
        paidBy: participants[0]?.id || "",
        shares: participants.map((p) => p.id),
      });
      setStep("validate");
    }
  }

  function updateItem(id, patch) {
    setDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  }
  function removeItem(id) {
    setDraft((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }));
  }
  function addItem() {
    setDraft((d) => ({
      ...d,
      items: [...d.items, { id: uid(), name: "", qty: 1, unit: "pièce(s)", unitPrice: 0, totalPrice: 0 }],
    }));
  }
  function toggleShare(pid) {
    setDraft((d) => ({
      ...d,
      shares: d.shares.includes(pid) ? d.shares.filter((x) => x !== pid) : [...d.shares, pid],
    }));
  }

  const itemsSum = draft ? Math.round(draft.items.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0) * 100) / 100 : 0;

  async function submit() {
    if (submitting) return;
    if (!draft.paidBy) {
      showToast("Choisissez qui a payé le ticket");
      return;
    }
    if (draft.shares.length === 0) {
      showToast("Sélectionnez au moins un participant");
      return;
    }
    setSubmitting(true);
    try {
      await saveReceipt({
        store: draft.store,
        purchaseDate: draft.purchaseDate,
        paidBy: draft.paidBy,
        total: Number(draft.total) || 0,
        imageFilename: draft.imageFilename,
        rawText: draft.rawText,
        items: draft.items
          .filter((it) => it.name.trim())
          .map(({ name, qty, unit, unitPrice, totalPrice }) => ({
            name,
            qty: Number(qty) || 0,
            unit,
            unitPrice: Number(unitPrice) || 0,
            totalPrice: Number(totalPrice) || 0,
          })),
        shares: draft.shares,
      });
      if (syncPrices) {
        for (const it of draft.items) {
          if (it.name.trim() && Number(it.unitPrice) > 0) rememberPrice(it.name, Number(it.unitPrice), it.unit);
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
        <p className="catalog-note">Photo directe ou fichier existant. Fonctionne mieux sur une surface plane et bien éclairée.</p>
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
      <div className="scan-meta-row">
        <label>
          Magasin
          <input type="text" value={draft.store} onChange={(e) => setDraft((d) => ({ ...d, store: e.target.value }))} />
        </label>
        <label>
          Date
          <input
            type="date"
            value={draft.purchaseDate}
            onChange={(e) => setDraft((d) => ({ ...d, purchaseDate: e.target.value }))}
          />
        </label>
      </div>

      <div className="receipt-items-table">
        {draft.items.map((it) => (
          <div className="receipt-item-row" key={it.id}>
            <input
              type="text"
              className="receipt-item-name"
              placeholder="Article"
              value={it.name}
              onChange={(e) => updateItem(it.id, { name: e.target.value })}
            />
            <div className="receipt-item-fields">
              <input
                type="number"
                step="any"
                value={it.qty}
                onChange={(e) => updateItem(it.id, { qty: e.target.value })}
                aria-label="Quantité"
              />
              <select value={it.unit} onChange={(e) => updateItem(it.id, { unit: e.target.value })} aria-label="Unité">
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                value={it.totalPrice}
                onChange={(e) => updateItem(it.id, { totalPrice: e.target.value })}
                aria-label="Prix total"
              />
              <button className="btn-icon" onClick={() => removeItem(it.id)} aria-label="Supprimer">
                🗑
              </button>
            </div>
          </div>
        ))}
        {draft.items.length === 0 && <p className="empty-message">Aucun article détecté — ajoutez-les manuellement.</p>}
      </div>
      <button className="btn" onClick={addItem}>
        ＋ Ligne libre
      </button>

      <div className="scan-total-row">
        <label>
          Total du ticket (€)
          <input
            type="number"
            step="0.01"
            value={draft.total}
            onChange={(e) => setDraft((d) => ({ ...d, total: e.target.value }))}
          />
        </label>
        {Math.abs(itemsSum - Number(draft.total)) > 0.01 && (
          <button className="btn" onClick={() => setDraft((d) => ({ ...d, total: itemsSum }))}>
            Utiliser la somme des lignes ({money(itemsSum)})
          </button>
        )}
      </div>

      <label className="scan-sync-price">
        <input type="checkbox" checked={syncPrices} onChange={(e) => setSyncPrices(e.target.checked)} />
        Mettre à jour la base de prix personnelle avec les prix de ce ticket
      </label>

      <h3>Répartition</h3>
      <label className="scan-paidby">
        Payé par
        <select value={draft.paidBy} onChange={(e) => setDraft((d) => ({ ...d, paidBy: e.target.value }))}>
          <option value="">—</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="scan-shares">
        {participants.map((p) => (
          <label key={p.id} className="rescale-meal-chip">
            <input type="checkbox" checked={draft.shares.includes(p.id)} onChange={() => toggleShare(p.id)} />
            {p.name}
          </label>
        ))}
        {participants.length === 0 && (
          <p className="empty-message">Ajoutez des participants dans la section ci-dessous avant de valider.</p>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? "Enregistrement…" : "Enregistrer la dépense"}
        </button>
      </div>
    </div>
  );
}
