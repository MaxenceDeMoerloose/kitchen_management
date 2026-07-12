import { useApp } from "../store.jsx";
import DaySelector from "./DaySelector.jsx";
import MealCard from "./MealCard.jsx";
import DayHousehold from "./DayHousehold.jsx";
import { MEALS, DAYS } from "../constants.js";
import { money, dayTotal } from "../utils.js";

export default function PlanningTab() {
  const { week, selectedDay } = useApp();
  const day = week[selectedDay];

  return (
    <div className="planning-tab">
      <DaySelector />
      <div className="day-header">
        <h2>{DAYS[selectedDay]}</h2>
        <span className="day-cost">{money(dayTotal(day))}</span>
      </div>
      <DayHousehold day={selectedDay} />
      <div className="meal-grid">
        {MEALS.map((m) => (
          <MealCard key={m.key} day={selectedDay} mealKey={m.key} label={m.label} />
        ))}
      </div>
      <p className="help-text">
        Les quantités sont proposées automatiquement selon la taille du foyer. Les prix sur fond jaune sont des
        estimations — corrigez-les si besoin, elles seront mémorisées pour la prochaine fois.
      </p>
    </div>
  );
}
