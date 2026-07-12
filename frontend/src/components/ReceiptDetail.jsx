import { useEffect, useState } from "react";
import { useApp } from "../store.jsx";
import ReceiptImage from "./ReceiptImage.jsx";
import ReceiptForm from "./ReceiptForm.jsx";
import { TrashIcon } from "./icons.jsx";
import { money, formatDateShort, uid, num, round2 } from "../utils.js";

function engineLabel(receipt) {
  if (receipt.engine === "openrouter") {
    const model = (receipt.model || "").split("/").pop()?.replace(":free", "");
    return `Lu par l'IA${model ? ` · ${model}` : ""}`;
  }
  if (receipt.engine === "tesseract") return "Lu par l'OCR local (moins fiable)";
  return null;
}

// Détail d'une dépense déjà enregistrée : la photo du ticket, le détail des lignes, la
// répartition — et la possibilité de tout corriger après coup.
export default function ReceiptDetail({ receipt, onClose }) {
  const { participants, updateReceiptEntry, deleteReceiptEntry, showToast } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !editing && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, onClose]);

  function startEditing() {
    setDraft({
      store: receipt.store,
      purchaseDate: receipt.purchaseDate,
      items: receipt.items.map((it) => ({ ...it, id: it.id || uid() })),
      total: receipt.total,
      paidBy: receipt.paidBy || "",
      shares: [...receipt.shares],
      imageFilename: receipt.imageFilename,
    });
    setEditing(true);
  }

  async function save() {
    if (saving) return;
    if (!draft.paidBy) return showToast("Choisissez qui a payé le ticket");
    if (draft.shares.length === 0) return showToast("Sélectionnez au moins un participant");
    setSaving(true);
    try {
      await updateReceiptEntry(receipt.id, {
        store: draft.store,
        purchaseDate: draft.purchaseDate,
        paidBy: draft.paidBy,
        total: num(draft.total),
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
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const payer = participants.find((p) => p.id === receipt.paidBy);
  const sharers = receipt.shares.map((id) => participants.find((p) => p.id === id)).filter(Boolean);
  const itemsSum = round2(receipt.items.reduce((s, it) => s + num(it.totalPrice), 0));
  const mismatch = Math.abs(itemsSum - num(receipt.total)) > 0.01;
  const label = engineLabel(receipt);

  return (
    <div className="modal-overlay" onClick={editing ? undefined : onClose}>
      <div className="modal-panel receipt-detail" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {receipt.store} — {formatDateShort(receipt.purchaseDate)}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {editing ? (
            <ReceiptForm draft={draft} setDraft={setDraft} participants={participants} />
          ) : (
            <>
              <ReceiptImage filename={receipt.imageFilename} />

              {mismatch && (
                <div className="receipt-warning">
                  <strong>⚠️ Le compte n'y est pas.</strong>
                  <span>
                    La somme des lignes fait {money(itemsSum)} mais le total enregistré est{" "}
                    {money(receipt.total)}. Ouvrez « Modifier » pour corriger.
                  </span>
                </div>
              )}

              <div className="receipt-detail-lines">
                {receipt.items.map((it) => (
                  <div
                    className={"receipt-detail-line" + (num(it.totalPrice) < 0 ? " is-discount" : "")}
                    key={it.id}
                  >
                    <span className="receipt-detail-name">{it.name}</span>
                    <span className="receipt-detail-qty">
                      {it.qty} {it.unit}
                    </span>
                    <span className="receipt-detail-price">{money(it.totalPrice)}</span>
                  </div>
                ))}
                {receipt.items.length === 0 && <p className="empty-message">Aucune ligne enregistrée.</p>}
              </div>

              <div className="receipt-detail-total">
                <span>Total</span>
                <strong>{money(receipt.total)}</strong>
              </div>

              <div className="receipt-detail-meta">
                <p>
                  <strong>Payé par</strong> {payer ? payer.name : "—"}
                </p>
                <p>
                  <strong>Partagé entre</strong>{" "}
                  {sharers.length ? sharers.map((p) => p.name).join(", ") : "—"}
                  {sharers.length > 0 && ` — ${money(num(receipt.total) / sharers.length)} par personne`}
                </p>
                {label && <p className="receipt-engine-badge">{label}</p>}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          {editing ? (
            <>
              <button className="btn" onClick={() => setEditing(false)} disabled={saving}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-danger btn-with-icon"
                onClick={() => {
                  if (confirm("Supprimer cette dépense ?")) {
                    deleteReceiptEntry(receipt.id);
                    onClose();
                  }
                }}
              >
                <TrashIcon size={17} /> Supprimer
              </button>
              <button className="btn btn-primary" onClick={startEditing}>
                ✏️ Modifier
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
