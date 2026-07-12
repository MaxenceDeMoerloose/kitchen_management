import { useState } from "react";
import { useApp } from "../store.jsx";
import ReceiptScanFlow from "./ReceiptScanFlow.jsx";
import ReceiptDetail from "./ReceiptDetail.jsx";
import ParticipantsManager from "./ParticipantsManager.jsx";
import { money, formatDateShort, num, round2 } from "../utils.js";

export default function ExpensesTab() {
  const { balances, receipts, participants } = useApp();
  const [scanning, setScanning] = useState(false);
  const [openId, setOpenId] = useState(null);

  if (scanning) return <ReceiptScanFlow onClose={() => setScanning(false)} />;

  // On relit le ticket depuis le store à chaque rendu : après une modification, la modale
  // affiche la version à jour sans avoir à la refermer.
  const openReceipt = receipts.find((r) => r.id === openId) || null;

  return (
    <div className="expenses-tab">
      <div className="card balances-card">
        <h2>💶 Soldes</h2>
        {balances.length === 0 && <p className="empty-message">Ajoutez des participants pour suivre les dépenses.</p>}
        <ul className="balances-list">
          {balances.map((b) => (
            <li key={b.id}>
              <span className="balance-name">{b.name}</span>
              <span className={"balance-amount" + (b.balance >= 0 ? " positive" : " negative")}>
                {b.balance > 0.001 && `on lui doit ${money(b.balance)}`}
                {b.balance < -0.001 && `doit ${money(-b.balance)}`}
                {Math.abs(b.balance) <= 0.001 && "à jour"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button className="btn btn-primary scan-trigger" onClick={() => setScanning(true)}>
        📷 Scanner un ticket
      </button>

      <div className="card">
        <h2>🧾 Dépenses enregistrées</h2>
        {receipts.length === 0 && <p className="empty-message">Aucune dépense pour l'instant.</p>}
        <div className="receipt-list">
          {receipts.map((r) => {
            const payer = participants.find((p) => p.id === r.paidBy);
            const itemsSum = round2(r.items.reduce((s, it) => s + num(it.totalPrice), 0));
            const mismatch = Math.abs(itemsSum - num(r.total)) > 0.01;
            return (
              <button
                className="receipt-card"
                key={r.id}
                onClick={() => setOpenId(r.id)}
                aria-label={`Voir le détail du ticket ${r.store} du ${formatDateShort(r.purchaseDate)}`}
              >
                <div className="receipt-card-main">
                  <div className="receipt-card-title">
                    {r.store} — {formatDateShort(r.purchaseDate)}
                    {mismatch && <span className="receipt-card-flag" title="Le compte n'y est pas">⚠️</span>}
                  </div>
                  <div className="receipt-card-meta">
                    {payer ? `Payé par ${payer.name}` : "Payeur inconnu"} · {r.items.length} article
                    {r.items.length > 1 ? "s" : ""} · {r.shares.length} participant{r.shares.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="receipt-card-actions">
                  {r.imageFilename && <span className="receipt-card-photo-dot" title="Photo disponible">📎</span>}
                  <span className="receipt-card-total">{money(r.total)}</span>
                  <span className="receipt-card-chevron" aria-hidden="true">›</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <ParticipantsManager />

      {openReceipt && <ReceiptDetail receipt={openReceipt} onClose={() => setOpenId(null)} />}
    </div>
  );
}
