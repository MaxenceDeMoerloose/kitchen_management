import { useState } from "react";
import { useApp } from "../store.jsx";
import { money, formatDateShort, addDays, isoLocal } from "../utils.js";

export default function HouseholdTab() {
  const { profile, saveProfile, portions, currentMonday, computePeriodTotal } = useApp();
  const [start, setStart] = useState(currentMonday);
  const [end, setEnd] = useState(() => isoLocal(addDays(currentMonday, 6)));
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function calculate() {
    setError("");
    setResult(null);
    if (start > end) {
      setError("La date de début doit être avant la date de fin.");
      return;
    }
    const r = await computePeriodTotal(start, end);
    setResult(r);
  }

  const pastaExample = (100 * portions).toFixed(0);

  return (
    <div className="household-tab">
      <div className="card">
        <h2>👨‍👩‍👧 Fiche du foyer</h2>
        <div className="stepper-row">
          <span>Nombre d'adultes</span>
          <div className="stepper">
            <button className="btn-icon" onClick={() => saveProfile({ adults: profile.adults - 1 })}>
              −
            </button>
            <span>{profile.adults}</span>
            <button className="btn-icon" onClick={() => saveProfile({ adults: profile.adults + 1 })}>
              +
            </button>
          </div>
        </div>
        <div className="stepper-row">
          <span>Nombre d'enfants (6-8 ans)</span>
          <div className="stepper">
            <button className="btn-icon" onClick={() => saveProfile({ children: profile.children - 1 })}>
              −
            </button>
            <span>{profile.children}</span>
            <button className="btn-icon" onClick={() => saveProfile({ children: profile.children + 1 })}>
              +
            </button>
          </div>
        </div>
        <div className="info-box">
          Équivalent portions : {portions.toFixed(1).replace(".", ",")}
          <br />
          Un enfant de 6-8 ans compte pour 0,65 portion adulte. Exemple : pour des pâtes (100 g/portion), le
          catalogue proposera {pastaExample} g.
        </div>
      </div>

      <div className="card">
        <h2>🧮 Total sur une période</h2>
        <div className="period-inputs">
          <label>
            Début
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            Fin
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <button className="btn btn-primary" onClick={calculate}>
            Calculer
          </button>
        </div>
        {error && <p className="error-message">{error}</p>}
        {result && (
          <div className="period-result">
            <div className="period-total">{money(result.total)}</div>
            <div className="period-sub">
              {result.daysCount} jours · {result.filledDays} jours planifiés
              {result.filledDays > 0 ? ` · moyenne ${money(result.total / result.filledDays)}/jour planifié` : ""}
            </div>
            {result.weeks.length > 0 && (
              <ul className="period-weeks">
                {result.weeks.map((w) => (
                  <li key={w.monday}>
                    Semaine du {formatDateShort(w.monday)} — {money(w.total)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
