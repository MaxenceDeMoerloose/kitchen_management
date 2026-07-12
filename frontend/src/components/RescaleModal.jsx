import { useMemo, useState } from "react";
import { useApp } from "../store.jsx";
import { DAYS_SHORT, MEALS } from "../constants.js";
import { addDays } from "../utils.js";

export default function RescaleModal() {
  const { rescaleInfo, closeRescale, applyRescale, week, currentMonday } = useApp();

  const dayMeals = useMemo(() => {
    return Array.from({ length: 7 }, (_, day) => {
      const meals = MEALS.map((m) => ({
        key: m.key,
        label: m.label,
        count: (week[day][m.key].items || []).length,
      }));
      return { day, date: addDays(currentMonday, day), meals };
    });
  }, [week, currentMonday]);

  const [selected, setSelected] = useState(() => {
    const s = new Set();
    for (const { day, meals } of dayMeals) {
      for (const m of meals) if (m.count > 0) s.add(`${day}|${m.key}`);
    }
    return s;
  });

  if (!rescaleInfo) return null;

  function toggleMeal(day, mealKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = `${day}|${mealKey}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function dayState(day, meals) {
    const keys = meals.filter((m) => m.count > 0).map((m) => `${day}|${m.key}`);
    if (keys.length === 0) return "empty";
    const selectedCount = keys.filter((k) => selected.has(k)).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === keys.length) return "all";
    return "some";
  }

  function toggleDay(day, meals) {
    const keys = meals.filter((m) => m.count > 0).map((m) => `${day}|${m.key}`);
    const state = dayState(day, meals);
    setSelected((prev) => {
      const next = new Set(prev);
      if (state === "all") keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  }

  function selectAll(value) {
    setSelected(() => {
      const s = new Set();
      if (value) {
        for (const { day, meals } of dayMeals) {
          for (const m of meals) if (m.count > 0) s.add(`${day}|${m.key}`);
        }
      }
      return s;
    });
  }

  return (
    <div className="modal-overlay" onClick={closeRescale}>
      <div className="modal-panel rescale-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Ajuster les quantités ?</h3>
          <button className="btn-icon" onClick={closeRescale} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p className="catalog-note">
          Le foyer est passé de {rescaleInfo.oldPortions.toFixed(1).replace(".", ",")} à{" "}
          {rescaleInfo.newPortions.toFixed(1).replace(".", ",")} portions. Choisissez les repas déjà planifiés à
          recalculer (quantités et prix).
        </p>
        <div className="rescale-select-all">
          <button className="btn" onClick={() => selectAll(true)}>
            Tout cocher
          </button>
          <button className="btn" onClick={() => selectAll(false)}>
            Tout décocher
          </button>
        </div>
        <div className="modal-body">
          {dayMeals.map(({ day, date, meals }) => {
            const state = dayState(day, meals);
            if (state === "empty") return null;
            return (
              <div className="rescale-day" key={day}>
                <label className="rescale-day-header">
                  <input
                    type="checkbox"
                    checked={state === "all"}
                    ref={(el) => el && (el.indeterminate = state === "some")}
                    onChange={() => toggleDay(day, meals)}
                  />
                  <strong>
                    {DAYS_SHORT[day]} {date.getDate()}
                  </strong>
                </label>
                <div className="rescale-meals">
                  {meals
                    .filter((m) => m.count > 0)
                    .map((m) => (
                      <label key={m.key} className="rescale-meal-chip">
                        <input
                          type="checkbox"
                          checked={selected.has(`${day}|${m.key}`)}
                          onChange={() => toggleMeal(day, m.key)}
                        />
                        {m.label}
                      </label>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={closeRescale}>
            Ignorer
          </button>
          <button className="btn btn-primary" onClick={() => applyRescale(selected)} disabled={selected.size === 0}>
            Ajuster la sélection ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
