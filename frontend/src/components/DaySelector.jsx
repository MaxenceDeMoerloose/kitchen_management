import { useApp } from "../store.jsx";
import { DAYS_SHORT } from "../constants.js";
import { addDays, money, dayTotal } from "../utils.js";

export default function DaySelector() {
  const { currentMonday, week, selectedDay, selectDay } = useApp();

  return (
    <div className="day-selector">
      {DAYS_SHORT.map((label, i) => {
        const date = addDays(currentMonday, i);
        const cost = dayTotal(week[i]);
        return (
          <button
            key={i}
            className={"day-pill" + (selectedDay === i ? " active" : "")}
            onClick={() => selectDay(i)}
          >
            <div>{label} {date.getDate()}</div>
            <div className="day-pill-cost">{cost > 0 ? money(cost) : "—"}</div>
          </button>
        );
      })}
    </div>
  );
}
