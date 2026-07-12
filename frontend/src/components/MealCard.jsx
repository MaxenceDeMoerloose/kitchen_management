import { useApp } from "../store.jsx";
import IngredientRow from "./IngredientRow.jsx";
import { StarIcon, BookIcon, SearchIcon } from "./icons.jsx";
import { money, mealTotal, libraryNameOf, mealIsEmpty } from "../utils.js";

export default function MealCard({ day, mealKey, label }) {
  const {
    week,
    library,
    updateMealDesc,
    addFreeLine,
    openCatalog,
    openLibrary,
    saveMealToLibrary,
    deleteLibraryEntry,
    showToast,
  } = useApp();
  const meal = week[day][mealKey];

  // L'étoile est pleine quand ce repas figure déjà dans la bibliothèque : on le reconnaît au
  // nom sous lequel il y serait enregistré. Sans ça, recliquer créait un doublon.
  const savedEntry = mealIsEmpty(meal)
    ? null
    : library.find((e) => e.mealType === mealKey && e.name === libraryNameOf(meal));

  function toggleLibrary() {
    if (savedEntry) {
      deleteLibraryEntry(savedEntry.id);
      showToast("Repas retiré de la bibliothèque");
    } else {
      saveMealToLibrary(day, mealKey);
    }
  }

  return (
    <div className="meal-card">
      <div className="meal-card-header">
        <span className="meal-label">{label}</span>
        <span className="meal-cost">{money(mealTotal(meal))}</span>
        <button
          className="icon-btn"
          title="Utiliser un repas de la bibliothèque"
          aria-label="Utiliser un repas de la bibliothèque"
          onClick={() => openLibrary(day, mealKey)}
        >
          <BookIcon />
        </button>
        <button
          className="icon-btn"
          onClick={toggleLibrary}
          aria-pressed={Boolean(savedEntry)}
          aria-label={savedEntry ? "Retirer de la bibliothèque" : "Enregistrer dans la bibliothèque"}
          title={savedEntry ? "Retirer de la bibliothèque" : "Enregistrer ce repas dans la bibliothèque"}
        >
          <StarIcon filled={Boolean(savedEntry)} />
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
        <button className="btn btn-primary btn-with-icon" onClick={() => openCatalog(day, mealKey)}>
          <SearchIcon size={17} /> Catalogue
        </button>
        <button className="btn" onClick={() => addFreeLine(day, mealKey)}>
          ＋ Ligne libre
        </button>
      </div>
    </div>
  );
}
