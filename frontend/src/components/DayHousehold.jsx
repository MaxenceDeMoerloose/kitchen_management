import { useState } from "react";
import { useApp } from "../store.jsx";
import DayHouseholdModal from "./DayHouseholdModal.jsx";

export default function DayHousehold({ day }) {
  const { week, profile, portionsForDay } = useApp();
  const [editing, setEditing] = useState(false);
  const override = week[day]?.people;
  const effective = override || profile;
  const portions = portionsForDay(day);

  return (
    <div className="day-household">
      <span className="day-household-icon">👥</span>
      <button className="day-household-btn" onClick={() => setEditing(true)}>
        {effective.adults} adulte{effective.adults > 1 ? "s" : ""} · {effective.children} enfant
        {effective.children > 1 ? "s" : ""}
        <span className="day-household-edit">✎</span>
      </button>
      <span className="day-household-portions">→ {portions.toFixed(1).replace(".", ",")} portions</span>
      {override ? (
        <span className="day-household-custom">(foyer du jour)</span>
      ) : (
        <span className="day-household-default">(foyer par défaut)</span>
      )}

      {editing && <DayHouseholdModal day={day} onClose={() => setEditing(false)} />}
    </div>
  );
}
