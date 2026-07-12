import { useApp } from "../store.jsx";
import IngredientRow from "./IngredientRow.jsx";
import { money, mealTotal } from "../utils.js";

export default function MealCard({ day, mealKey, label }) {
  const { week, updateMealDesc, addFreeLine, openCatalog, openLibrary, saveMealToLibrary } = useApp();
  const meal = week[day][mealKey];

  return (
    <div className="meal-card">
      <div className="meal-card-header">
        <span className="meal-label">{label}</span>
        <span className="meal-cost">{money(mealTotal(meal))}</span>
        <button
          className="btn-icon"
          title="Utiliser un repas de la bibliothèque"
          onClick={() => openLibrary(day, mealKey)}
        >
          📖
        </button>
        <button
          className="btn-icon"
          title="Enregistrer ce repas dans la bibliothèque"
          onClick={() => saveMealToLibrary(day, mealKey)}
        >
          ⭐
        </button>
      </div>
      <textarea
        className="meal-desc"
        placeholder="Description du repas (ex : Spaghetti bolognaise maison)…"
        value={meal.desc}
        onChange={(e) => updateMealDesc(day, mealKey, e.target.value)}
      />
      <div className="ingredient-list">
        {meal.items.map((item) => (
          <IngredientRow key={item.id} day={day} mealKey={mealKey} item={item} />
        ))}
      </div>
      <div className="meal-card-actions">
        <button className="btn btn-primary" onClick={() => openCatalog(day, mealKey)}>
          🔍 Catalogue
        </button>
        <button className="btn" onClick={() => addFreeLine(day, mealKey)}>
          ＋ Ligne libre
        </button>
      </div>
    </div>
  );
}
