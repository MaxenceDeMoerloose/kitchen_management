import { useApp } from "../store.jsx";
import { UNITS } from "../constants.js";
import { TrashIcon } from "./icons.jsx";
import { num, round2, unitPriceOf, money, priceUnitFor, toDisplayPrice } from "../utils.js";

export default function IngredientRow({ day, mealKey, item }) {
  const { updateItem, removeItem, suggest, rememberPrice } = useApp();

  // Chaque ligne porte son prix unitaire ; le prix affiché est le total de la ligne
  // (prix unitaire × quantité). Les deux restent synchronisés quoi que l'on modifie.
  const unitPrice = unitPriceOf(item);

  function handleNameBlur() {
    if (item.price !== "" && num(item.price) > 0) return;
    const s = suggest(item.name);
    if (!s) return;
    // s.price est un prix UNITAIRE : le total de la ligne en dépend de la quantité.
    const qty = num(item.qty);
    updateItem(day, mealKey, item.id, {
      unitPrice: s.price,
      price: qty > 0 ? round2(s.price * qty) : "",
      unit: s.unit,
      _src: s.source,
      emoji: s.emoji ?? item.emoji,
    });
  }

  // Changer la quantité doit recalculer le prix : sans ça il restait figé sur l'ancien total.
  function handleQtyChange(e) {
    const raw = e.target.value;
    if (raw === "") return updateItem(day, mealKey, item.id, { qty: "" });
    const qty = Number(raw);
    const patch = { qty };
    if (unitPrice > 0) patch.price = round2(unitPrice * qty);
    updateItem(day, mealKey, item.id, patch);
  }

  // Changer l'unité change le sens du prix unitaire (€/g ≠ €/kg) : on repart du prix
  // unitaire suggéré pour cette unité plutôt que de garder un chiffre devenu faux.
  function handleUnitChange(e) {
    const unit = e.target.value;
    const patch = { unit };
    const s = suggest(item.name);
    const qty = num(item.qty);
    if (s && s.unit === unit && s.price > 0) {
      patch.unitPrice = s.price;
      patch.price = qty > 0 ? round2(s.price * qty) : "";
      patch._src = s.source;
    }
    updateItem(day, mealKey, item.id, patch);
  }

  // L'utilisateur saisit le TOTAL de la ligne : on en déduit le prix unitaire.
  function handlePriceChange(e) {
    const raw = e.target.value;
    if (raw === "") return updateItem(day, mealKey, item.id, { price: "", _src: "" });
    const price = Number(raw);
    const qty = num(item.qty);
    updateItem(day, mealKey, item.id, {
      price,
      unitPrice: qty > 0 ? price / qty : 0,
      _src: "",
    });
  }

  // On mémorise le prix UNITAIRE, jamais le total : la base de prix est relue comme un
  // prix unitaire partout ailleurs (catalogue, tickets).
  function handlePriceBlur() {
    if (item.name.trim() && unitPrice > 0) rememberPrice(item.name, unitPrice, item.unit);
  }

  const estimated = item._src === "estimation";

  return (
    <div className="ingredient-row">
      <div className="ingredient-top">
        <span className="ingredient-emoji">{item.emoji || "🛒"}</span>
        <input
          type="text"
          className="ingredient-name"
          value={item.name}
          placeholder="Produit"
          onChange={(e) => updateItem(day, mealKey, item.id, { name: e.target.value })}
          onBlur={handleNameBlur}
        />
      </div>
      <div className="ingredient-bottom">
        <input
          type="number"
          className="ingredient-qty"
          value={item.qty}
          min="0"
          step="any"
          aria-label="Quantité"
          onChange={handleQtyChange}
        />
        <select className="ingredient-unit" value={item.unit} aria-label="Unité" onChange={handleUnitChange}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <div className="ingredient-price-wrap">
          <input
            type="number"
            className={"ingredient-price" + (estimated ? " estimated" : "")}
            title={estimated ? "Prix estimé — corrigez si besoin" : "Prix total de la ligne"}
            value={item.price}
            min="0"
            step="any"
            aria-label="Prix total en euros"
            onChange={handlePriceChange}
            onBlur={handlePriceBlur}
          />
          <span className="price-suffix">€</span>
        </div>
        <button
          className="ingredient-delete btn-icon"
          onClick={() => removeItem(day, mealKey, item.id)}
          aria-label="Supprimer"
        >
          <TrashIcon />
        </button>
      </div>
      {unitPrice > 0 && (
        <span className="ingredient-unit-price">
          {money(toDisplayPrice(unitPrice, item.unit))} / {priceUnitFor(item.unit).label}
          {estimated && " (estimé)"}
        </span>
      )}
    </div>
  );
}
