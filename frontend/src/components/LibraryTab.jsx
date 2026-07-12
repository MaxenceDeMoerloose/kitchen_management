import { useApp } from "../store.jsx";
import { MEALS } from "../constants.js";
import { money } from "../utils.js";

const MEAL_LABEL = Object.fromEntries(MEALS.map((m) => [m.key, m.label]));

export default function LibraryTab() {
  const { library, deleteLibraryEntry } = useApp();

  if (library.length === 0) {
    return (
      <p className="empty-message">
        Aucun repas enregistré. Utilisez ⭐ sur un repas du planning pour l'ajouter ici.
      </p>
    );
  }

  return (
    <div className="library-grid">
      {library.map((entry) => {
        const total = entry.items.reduce((s, it) => s + (Number(it.price) || 0), 0);
        const preview = entry.items.slice(0, 5);
        const more = entry.items.length - preview.length;
        return (
          <div className="library-card" key={entry.id}>
            <div className="library-card-type">{MEAL_LABEL[entry.mealType]}</div>
            <h3>{entry.name}</h3>
            <ul className="library-preview">
              {preview.map((it) => (
                <li key={it.id}>
                  {it.emoji} {it.name} — {it.qty} {it.unit} — {money(it.price)}
                </li>
              ))}
            </ul>
            {more > 0 && <div className="library-more">… +{more} autres</div>}
            <div className="library-card-footer">
              <span className="library-total">{money(total)}</span>
              <button
                className="btn-icon"
                onClick={() => {
                  if (confirm(`Supprimer « ${entry.name} » de la bibliothèque ?`)) deleteLibraryEntry(entry.id);
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
  );
}
