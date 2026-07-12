import { useState } from "react";
import { useApp } from "../store.jsx";
import { MEALS, CATEGORY_ORDER } from "../constants.js";
import { formatDateShort, parseLocalDate, mealIndex, groupByCategory, money, capitalize } from "../utils.js";

const MEAL_LABEL = Object.fromEntries(MEALS.map((m) => [m.key, m.label]));

function isValidRange(startDate, startMeal, endDate, endMeal) {
  if (!startDate || !endDate) return false;
  const s = parseLocalDate(startDate);
  const e = parseLocalDate(endDate);
  if (s > e) return false;
  if (s.getTime() === e.getTime() && mealIndex(startMeal) > mealIndex(endMeal)) return false;
  return true;
}

function periodLabel(p) {
  if (p.label && p.label.trim()) return p.label;
  return `${formatDateShort(p.startDate)} (${MEAL_LABEL[p.startMeal]}) → ${formatDateShort(p.endDate)} (${MEAL_LABEL[p.endMeal]})`;
}

const emptyForm = (today) => ({
  label: "",
  startDate: today,
  startMeal: "matin",
  endDate: today,
  endMeal: "soir",
  adults: 2,
  children: 0,
});

export default function GestionTab() {
  const { periods, addPeriod, deletePeriod, computePeriodShopping, currentMonday, catalog, showToast } = useApp();
  const [form, setForm] = useState(() => emptyForm(currentMonday));
  const [error, setError] = useState("");
  const [results, setResults] = useState({}); // id -> { loading, lines, total }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!isValidRange(form.startDate, form.startMeal, form.endDate, form.endMeal)) {
      setError("La date/repas de fin doit être après le début.");
      return;
    }
    await addPeriod({
      label: form.label.trim(),
      startDate: form.startDate,
      startMeal: form.startMeal,
      endDate: form.endDate,
      endMeal: form.endMeal,
      adults: Math.max(0, Number(form.adults) || 0),
      children: Math.max(0, Number(form.children) || 0),
    });
    showToast("Période enregistrée");
    setForm(emptyForm(currentMonday));
  }

  async function toggleView(period) {
    setResults((r) => {
      if (r[period.id]) {
        const next = { ...r };
        delete next[period.id];
        return next;
      }
      return { ...r, [period.id]: { loading: true } };
    });
    if (results[period.id]) return;
    const { lines, total } = await computePeriodShopping(period);
    setResults((r) => (r[period.id] ? { ...r, [period.id]: { loading: false, lines, total } } : r));
  }

  async function copyResult(period, lines, total) {
    const groups = groupByCategory(lines, catalog, CATEGORY_ORDER);
    const body = groups
      .map((g) => `${g.cat.toUpperCase()}\n${g.items.map((l) => `☐ ${l.emoji} ${capitalize(l.name)} — ${l.qty} ${l.unit} — ${money(l.price)}`).join("\n")}`)
      .join("\n\n");
    const text = `Courses — ${periodLabel(period)}\n\n${body}\n\nTotal : ${money(total)}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    showToast("Liste copiée");
  }

  return (
    <div className="gestion-tab">
      <div className="card">
        <h2>🗓️ Nouvelle tranche de dates</h2>
        <form className="period-form" onSubmit={submit}>
          <label className="period-form-label-field">
            Libellé (optionnel)
            <input
              type="text"
              placeholder="Ex : Visite famille"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </label>
          <div className="period-form-row">
            <label>
              Début
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </label>
            <label>
              Repas de début
              <select value={form.startMeal} onChange={(e) => setForm((f) => ({ ...f, startMeal: e.target.value }))}>
                {MEALS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="period-form-row">
            <label>
              Fin
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </label>
            <label>
              Repas de fin
              <select value={form.endMeal} onChange={(e) => setForm((f) => ({ ...f, endMeal: e.target.value }))}>
                {MEALS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="period-form-row">
            <label>
              Adultes
              <input
                type="number"
                min="0"
                value={form.adults}
                onChange={(e) => setForm((f) => ({ ...f, adults: e.target.value }))}
              />
            </label>
            <label>
              Enfants (6-8 ans)
              <input
                type="number"
                min="0"
                value={form.children}
                onChange={(e) => setForm((f) => ({ ...f, children: e.target.value }))}
              />
            </label>
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="btn btn-primary">
            Ajouter la période
          </button>
        </form>
      </div>

      <div className="card">
        <h2>📋 Périodes enregistrées</h2>
        {periods.length === 0 && <p className="empty-message">Aucune période enregistrée pour le moment.</p>}
        <div className="period-list">
          {periods.map((p) => {
            const res = results[p.id];
            return (
              <div className="period-card" key={p.id}>
                <div className="period-card-header">
                  <div>
                    <div className="period-card-title">{periodLabel(p)}</div>
                    <div className="period-card-meta">
                      👥 {p.adults} adulte{p.adults > 1 ? "s" : ""}
                      {p.children > 0 ? ` · ${p.children} enfant${p.children > 1 ? "s" : ""}` : ""}
                    </div>
                  </div>
                  <div className="period-card-actions">
                    <button className="btn" onClick={() => toggleView(p)}>
                      {res ? "Masquer" : "🛒 Voir les courses"}
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => {
                        if (confirm("Supprimer cette période ?")) deletePeriod(p.id);
                      }}
                      aria-label="Supprimer"
                    >
                      🗑
                    </button>
                  </div>
                </div>
                {res && res.loading && <p className="empty-message">Calcul en cours…</p>}
                {res && !res.loading && (
                  <div className="period-shopping">
                    {res.lines.length === 0 ? (
                      <p className="empty-message">Aucun repas planifié sur cette tranche.</p>
                    ) : (
                      <>
                        {groupByCategory(res.lines, catalog, CATEGORY_ORDER).map((g) => (
                          <div className="shopping-group" key={g.cat}>
                            <h4 className="shopping-group-title">{g.cat}</h4>
                            <ul>
                              {g.items.map((l) => (
                                <li key={l.key}>
                                  <label>
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
                        <div className="shopping-footer">
                          <button className="btn" onClick={() => copyResult(p, res.lines, res.total)}>
                            📋 Copier
                          </button>
                          <span>Total : {money(res.total)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
