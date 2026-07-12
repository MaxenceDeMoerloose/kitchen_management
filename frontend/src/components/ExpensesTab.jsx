import { useState } from "react";
import { useApp } from "../store.jsx";
import ReceiptScanFlow from "./ReceiptScanFlow.jsx";
import ParticipantsManager from "./ParticipantsManager.jsx";
import { money, formatDateShort } from "../utils.js";

export default function ExpensesTab() {
  const { balances, receipts, participants, deleteReceiptEntry } = useApp();
  const [scanning, setScanning] = useState(false);

  if (scanning) return <ReceiptScanFlow onClose={() => setScanning(false)} />;

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
            return (
              <div className="receipt-card" key={r.id}>
                <div>
                  <div className="receipt-card-title">
                    {r.store} — {formatDateShort(r.purchaseDate)}
                  </div>
                  <div className="receipt-card-meta">
                    {payer ? `Payé par ${payer.name}` : "Payeur inconnu"} · {r.items.length} article
                    {r.items.length > 1 ? "s" : ""} · {r.shares.length} participant{r.shares.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="receipt-card-actions">
                  <span className="receipt-card-total">{money(r.total)}</span>
                  <button
                    className="btn-icon"
                    onClick={() => {
                      if (confirm("Supprimer cette dépense ?")) deleteReceiptEntry(r.id);
                    }}
                    aria-label="Supprimer"
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ParticipantsManager />
    </div>
  );
}
