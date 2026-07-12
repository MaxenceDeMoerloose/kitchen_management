import { useApp } from "../store.jsx";
import { UNITS } from "../constants.js";

export default function IngredientRow({ day, mealKey, item }) {
  const { updateItem, removeItem, suggest, rememberPrice } = useApp();

  function handleNameBlur() {
    const price = Number(item.price);
    if (item.price !== "" && price > 0) return;
    const s = suggest(item.name);
    if (!s) return;
    updateItem(day, mealKey, item.id, {
      price: s.price,
      unit: s.unit,
      _src: s.source,
      emoji: s.emoji ?? item.emoji,
    });
  }

  function handlePriceChange(e) {
    const v = e.target.value;
    updateItem(day, mealKey, item.id, { price: v === "" ? "" : Number(v), _src: "" });
  }

  function handlePriceBlur() {
    const price = Number(item.price);
    if (item.name.trim() && price > 0) rememberPrice(item.name, price, item.unit);
  }

  const estimated = item._src === "estimation";

  return (
    <div className="ingredient-row">
      <span className="ingredient-emoji">{item.emoji || "🛒"}</span>
      <input
        type="text"
        className="ingredient-name"
        value={item.name}
        placeholder="Produit"
        onChange={(e) => updateItem(day, mealKey, item.id, { name: e.target.value })}
        onBlur={handleNameBlur}
      />
      <input
        type="number"
        className="ingredient-qty"
        value={item.qty}
        min="0"
        step="any"
        onChange={(e) =>
          updateItem(day, mealKey, item.id, { qty: e.target.value === "" ? "" : Number(e.target.value) })
        }
      />
      <select
        className="ingredient-unit"
        value={item.unit}
        onChange={(e) => updateItem(day, mealKey, item.id, { unit: e.target.value })}
      >
        {UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <input
        type="number"
        className={"ingredient-price" + (estimated ? " estimated" : "")}
        title={estimated ? "Prix estimé — corrigez si besoin" : undefined}
        value={item.price}
        min="0"
        step="0.01"
        onChange={handlePriceChange}
        onBlur={handlePriceBlur}
      />
      <button className="btn-icon" onClick={() => removeItem(day, mealKey, item.id)} aria-label="Supprimer">
        🗑
      </button>
    </div>
  );
}
