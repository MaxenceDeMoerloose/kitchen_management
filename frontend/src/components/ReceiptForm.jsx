import { UNITS } from "../constants.js";
import { uid, money, num, round2 } from "../utils.js";
import ReceiptImage from "./ReceiptImage.jsx";
import { TrashIcon } from "./icons.jsx";

// Éditeur de ticket, partagé entre la validation après scan et la modification d'une
// dépense déjà enregistrée. Entièrement contrôlé : le parent détient le brouillon.
export default function ReceiptForm({ draft, setDraft, participants }) {
  const itemsSum = round2(draft.items.reduce((s, it) => s + num(it.totalPrice), 0));
  const total = num(draft.total);
  const gap = round2(itemsSum - total);
  const mismatch = Math.abs(gap) > 0.01;

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

  return (
    <>
      {draft.imageFilename && (
        <div className="receipt-form-photo">
          <ReceiptImage filename={draft.imageFilename} />
          <p className="catalog-note">Comparez chaque ligne à la photo avant d'enregistrer.</p>
        </div>
      )}

      {/* L'écart se recalcule à chaque frappe : l'alerte disparaît dès que le compte tombe juste. */}
      {mismatch && (
        <div className="receipt-warning">
          <strong>⚠️ Le compte n'y est pas.</strong>
          <span>
            La somme des lignes fait {money(itemsSum)} mais le ticket annonce {money(total)} — il manque{" "}
            {money(Math.abs(gap))} {gap > 0 ? "de trop dans les lignes" : "dans les lignes"}. Une ligne a
            probablement été mal lue : corrigez-la en vous aidant de la photo.
          </span>
        </div>
      )}

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
          <div className={"receipt-item-row" + (num(it.totalPrice) < 0 ? " is-discount" : "")} key={it.id}>
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
              <button className="btn-icon" onClick={() => removeItem(it.id)} aria-label="Supprimer la ligne">
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
        {draft.items.length === 0 && <p className="empty-message">Aucun article détecté — ajoutez-les manuellement.</p>}
      </div>

      <div className="receipt-sum-row">
        <button className="btn" onClick={addItem}>
          ＋ Ligne libre
        </button>
        <span className="receipt-sum-value">
          Somme des lignes : <strong>{money(itemsSum)}</strong>
        </span>
      </div>

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
        {mismatch && (
          <button className="btn" onClick={() => setDraft((d) => ({ ...d, total: itemsSum }))}>
            Utiliser {money(itemsSum)}
          </button>
        )}
      </div>

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
          <p className="empty-message">Ajoutez des participants avant de valider.</p>
        )}
      </div>
      {draft.shares.length > 0 && total > 0 && (
        <p className="catalog-note">
          Soit {money(total / draft.shares.length)} par personne ({draft.shares.length} participant
          {draft.shares.length > 1 ? "s" : ""}).
        </p>
      )}
    </>
  );
}
