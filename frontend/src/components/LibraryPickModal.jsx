import { useApp } from "../store.jsx";
import { money } from "../utils.js";

export default function LibraryPickModal() {
  const { closeModal, library, applyLibraryEntry } = useApp();

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-panel library-pick-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Choisir un repas de la bibliothèque</h3>
          <button className="btn-icon" onClick={closeModal} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {library.length === 0 && (
            <p className="empty-message">
              Bibliothèque vide — utilisez l’étoile ☆ sur un repas pour l'enregistrer d'abord.
            </p>
          )}
          {library.map((entry) => {
            const total = entry.items.reduce((s, it) => s + (Number(it.price) || 0), 0);
            return (
              <button key={entry.id} className="library-pick-item" onClick={() => applyLibraryEntry(entry)}>
                <span className="library-pick-name">{entry.name}</span>
                <span className="library-pick-meta">
                  {entry.items.length} produits · {money(total)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
