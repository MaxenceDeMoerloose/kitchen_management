import { useApp } from "../store.jsx";
import { aggregateWeek, money, capitalize, formatDateShort } from "../utils.js";

export default function ShoppingTab() {
  const { week, checked, toggleChecked, currentMonday, showToast } = useApp();
  const lines = aggregateWeek(week);
  const total = lines.reduce((s, l) => s + l.price, 0);
  const remaining = lines.filter((l) => !checked[l.key]).length;

  function exportText() {
    const header = `Liste de courses — semaine du ${formatDateShort(currentMonday)}`;
    const body = lines
      .map(
        (l) =>
          `[${checked[l.key] ? "x" : " "}] ${l.emoji} ${capitalize(l.name)} — ${l.qty} ${l.unit} — ${money(l.price)}`
      )
      .join("\n");
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
      <ul className="shopping-list" id="printable-list">
        {lines.map((l) => (
          <li key={l.key} className={checked[l.key] ? "checked" : ""}>
            <label>
              <input type="checkbox" checked={!!checked[l.key]} onChange={() => toggleChecked(l.key)} />
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
      <div className="shopping-footer">
        <span>
          Reste à acheter : {remaining} produit{remaining > 1 ? "s" : ""}
        </span>
        <span>Total : {money(total)}</span>
      </div>
    </div>
  );
}
