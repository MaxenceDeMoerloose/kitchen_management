import { useApp } from "../store.jsx";

export default function DayHousehold({ day }) {
  const { week, profile, setDayProfile, portionsForDay } = useApp();
  const override = week[day]?.people;
  const effective = override || profile;
  const isCustom = !!override;
  const portions = portionsForDay(day);

  function update(patch) {
    setDayProfile(day, {
      adults: Math.max(0, patch.adults ?? effective.adults),
      children: Math.max(0, patch.children ?? effective.children),
    });
  }

  return (
    <div className="day-household">
      <span className="day-household-icon">👥</span>
      <div className="day-household-stepper">
        <button className="btn-icon" onClick={() => update({ adults: effective.adults - 1 })} aria-label="Moins d'adultes">
          −
        </button>
        <span>
          {effective.adults} adulte{effective.adults > 1 ? "s" : ""}
        </span>
        <button className="btn-icon" onClick={() => update({ adults: effective.adults + 1 })} aria-label="Plus d'adultes">
          +
        </button>
      </div>
      <div className="day-household-stepper">
        <button
          className="btn-icon"
          onClick={() => update({ children: effective.children - 1 })}
          aria-label="Moins d'enfants"
        >
          −
        </button>
        <span>
          {effective.children} enfant{effective.children > 1 ? "s" : ""}
        </span>
        <button
          className="btn-icon"
          onClick={() => update({ children: effective.children + 1 })}
          aria-label="Plus d'enfants"
        >
          +
        </button>
      </div>
      <span className="day-household-portions">→ {portions.toFixed(1).replace(".", ",")} portions</span>
      {isCustom ? (
        <button className="day-household-reset" onClick={() => setDayProfile(day, null)}>
          ↺ Foyer par défaut
        </button>
      ) : (
        <span className="day-household-default">(foyer par défaut)</span>
      )}
    </div>
  );
}
