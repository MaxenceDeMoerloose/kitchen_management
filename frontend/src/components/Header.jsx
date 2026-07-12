import { useApp } from "../store.jsx";
import { addDays, formatDateShort, money, weekTotal, aggregateWeek } from "../utils.js";

const TABS = [
  { key: "planning", label: "Planning" },
  { key: "courses", label: "Courses" },
  { key: "bibliotheque", label: "Bibliothèque" },
  { key: "fiche", label: "Fiche & totaux" },
  { key: "gestion", label: "Gestion" },
];

export default function Header() {
  const { currentMonday, week, checked, goToWeek, goToday, activeTab, setActiveTab } = useApp();
  const sunday = addDays(currentMonday, 6);
  const total = weekTotal(week);
  const shoppingCount = aggregateWeek(week).filter((l) => !checked[l.key]).length;

  return (
    <header className="header">
      <div className="header-top">
        <h1 className="header-title">Planificateur de repas</h1>
        <nav className="week-nav">
          <button className="btn-icon" onClick={() => goToWeek(-1)} aria-label="Semaine précédente">◀</button>
          <span>
            Semaine du {formatDateShort(currentMonday)} au {formatDateShort(sunday)}
          </span>
          <button className="btn-icon" onClick={() => goToWeek(1)} aria-label="Semaine suivante">▶</button>
          <button className="btn" onClick={goToday}>Aujourd'hui</button>
        </nav>
        <div className="header-total">{money(total)}</div>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={"tab" + (activeTab === t.key ? " active" : "")}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.key === "courses" ? ` (${shoppingCount})` : ""}
          </button>
        ))}
      </div>
    </header>
  );
}
