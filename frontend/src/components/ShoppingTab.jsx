import { useState } from "react";
import { useApp } from "../store.jsx";
import { CATEGORY_ORDER } from "../constants.js";
import { aggregateWeek, groupByCategory, money, capitalize, formatDateShort } from "../utils.js";

function formatDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ShoppingTab() {
  const { week, checked, toggleChecked, currentMonday, showToast, catalog, shoppingStatus, validateShopping, reopenShopping } =
    useApp();
  const [shopperName, setShopperName] = useState("");
  const [showValidateForm, setShowValidateForm] = useState(false);

  const lines = aggregateWeek(week);
  const total = lines.reduce((s, l) => s + l.price, 0);
  const remaining = lines.filter((l) => !checked[l.key]).length;
  const groups = groupByCategory(lines, catalog, CATEGORY_ORDER);

  function exportText() {
    const header = `Liste de courses — semaine du ${formatDateShort(currentMonday)}`;
    const body = groups
      .map((g) => {
        const items = g.items
          .map(
            (l) =>
              `${checked[l.key] ? "☑" : "☐"} ${l.emoji} ${capitalize(l.name)} — ${l.qty} ${l.unit} — ${money(l.price)}`
          )
          .join("\n");
        return `${g.cat.toUpperCase()}\n${items}`;
      })
      .join("\n\n");
    return `${header}\n\n${body}\n\nTotal : ${money(total)}`;
  }

  async function copyList() {
    const text = exportText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    showToast("Liste copiée");
  }

  function downloadList() {
    const blob = new Blob([exportText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `courses-${currentMonday}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function submitValidate(e) {
    e.preventDefault();
    if (!shopperName.trim()) return;
    validateShopping(shopperName);
    setShowValidateForm(false);
    setShopperName("");
  }

  if (lines.length === 0) {
    return <p className="empty-message">Remplissez le planning de la semaine pour générer votre liste de courses.</p>;
  }

  return (
    <div className="shopping-tab">
      <div className="shopping-header">
        <h2>
          Courses de la semaine — {lines.length} produits · {money(total)}
        </h2>
        <div className="shopping-actions">
          <button className="btn" onClick={copyList}>
            📋 Copier
          </button>
          <button className="btn" onClick={downloadList}>
            ⬇ Télécharger
          </button>
          <button className="btn" onClick={() => window.print()}>
            🖨 Imprimer
          </button>
        </div>
      </div>

      {shoppingStatus.done ? (
        <div className="shopping-status done">
          <span>
            ✅ Courses faites le {formatDateTime(shoppingStatus.doneAt)}
            {shoppingStatus.doneBy ? ` par ${shoppingStatus.doneBy}` : ""}
          </span>
          <button className="btn" onClick={reopenShopping}>
            Rouvrir la liste
          </button>
        </div>
      ) : showValidateForm ? (
        <form className="shopping-status form" onSubmit={submitValidate}>
          <input
            type="text"
            autoFocus
            placeholder="Qui fait les courses ?"
            value={shopperName}
            onChange={(e) => setShopperName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={!shopperName.trim()}>
            Valider
          </button>
          <button type="button" className="btn" onClick={() => setShowValidateForm(false)}>
            Annuler
          </button>
        </form>
      ) : (
        <div className="shopping-status">
          <button className="btn" onClick={() => setShowValidateForm(true)}>
            ✅ Marquer les courses comme faites
          </button>
        </div>
      )}

      <div className="shopping-list" id="printable-list">
        <h1 className="print-title">Liste de courses — semaine du {formatDateShort(currentMonday)}</h1>
        {groups.map((g) => (
          <div className="shopping-group" key={g.cat}>
            <h4 className="shopping-group-title">{g.cat}</h4>
            <ul>
              {g.items.map((l) => (
                <li key={l.key} className={checked[l.key] ? "checked" : ""}>
                  <label>
                    <span className={"check-circle" + (checked[l.key] ? " checked" : "")}>
                      <input type="checkbox" checked={!!checked[l.key]} onChange={() => toggleChecked(l.key)} />
                      <span className="check-mark">✓</span>
                    </span>
                    <span className="shopping-emoji">{l.emoji}</span>
                    <span className="shopping-name">{capitalize(l.name)}</span>
                    <span className="shopping-qty">
                      {l.qty} {l.unit}
                    </span>
                    <span className="shopping-price">{money(l.price)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="shopping-footer print-footer">
          <span>
            Reste à acheter : {remaining} produit{remaining > 1 ? "s" : ""}
          </span>
          <span>Total : {money(total)}</span>
        </div>
      </div>
    </div>
  );
}
