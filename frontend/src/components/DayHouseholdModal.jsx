import { useEffect, useState } from "react";
import { useApp } from "../store.jsx";
import { DAYS } from "../constants.js";
import { portionsFor, num } from "../utils.js";

// Saisie du nombre exact de personnes pour un jour donné. On ne valide qu'au clic sur
// « Valider » : sans ça, chaque incrément relançait la modale d'ajustement des quantités.
export default function DayHouseholdModal({ day, onClose }) {
  const { week, profile, setDayProfile } = useApp();
  const override = week[day]?.people;
  const effective = override || profile;

  const [adults, setAdults] = useState(String(effective.adults));
  const [children, setChildren] = useState(String(effective.children));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const a = Math.max(0, Math.round(num(adults)));
  const c = Math.max(0, Math.round(num(children)));
  const portions = portionsFor({ adults: a, children: c }, profile.childFactor);
  const empty = a + c === 0;

  function validate() {
    if (empty) return;
    // Déclenche la modale « Ajuster les quantités ? » si le nombre de portions change
    // et que le jour contient déjà des repas.
    setDayProfile(day, { adults: a, children: c });
    onClose();
  }

  function resetToDefault() {
    setDayProfile(day, null);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel household-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Personnes — {DAYS[day]}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="household-field">
            <label htmlFor="household-adults">Adultes</label>
            <div className="household-input-row">
              <button className="btn-icon" onClick={() => setAdults(String(Math.max(0, a - 1)))} aria-label="Moins d'adultes">
                −
              </button>
              <input
                id="household-adults"
                type="number"
                min="0"
                inputMode="numeric"
                value={adults}
                onChange={(e) => setAdults(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
              <button className="btn-icon" onClick={() => setAdults(String(a + 1))} aria-label="Plus d'adultes">
                +
              </button>
            </div>
          </div>

          <div className="household-field">
            <label htmlFor="household-children">Enfants</label>
            <div className="household-input-row">
              <button
                className="btn-icon"
                onClick={() => setChildren(String(Math.max(0, c - 1)))}
                aria-label="Moins d'enfants"
              >
                −
              </button>
              <input
                id="household-children"
                type="number"
                min="0"
                inputMode="numeric"
                value={children}
                onChange={(e) => setChildren(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
              <button className="btn-icon" onClick={() => setChildren(String(c + 1))} aria-label="Plus d'enfants">
                +
              </button>
            </div>
          </div>

          <p className="household-portions">
            → <strong>{portions.toFixed(1).replace(".", ",")} portions</strong>
            <span className="catalog-note"> (un enfant compte pour {profile.childFactor.toLocaleString("fr-BE")})</span>
          </p>
          {empty && <p className="empty-message">Indiquez au moins une personne.</p>}

          {override && (
            <button className="btn household-reset" onClick={resetToDefault}>
              ↺ Revenir au foyer par défaut ({profile.adults} adulte{profile.adults > 1 ? "s" : ""},{" "}
              {profile.children} enfant{profile.children > 1 ? "s" : ""})
            </button>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={validate} disabled={empty}>
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
