import { CHILD_FACTOR, MEALS } from "./constants.js";

const MEAL_ORDER = MEALS.map((m) => m.key);
export function mealIndex(key) {
  return MEAL_ORDER.indexOf(key);
}

export function normalize(name) {
  return (name || "").trim().toLowerCase();
}

export function uid() {
  return crypto.randomUUID();
}

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function round2(v) {
  return Math.round(v * 100) / 100;
}

export function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function isoLocal(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

export function parseLocalDate(str) {
  return new Date(str + "T00:00:00");
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function formatDateShort(date) {
  return new Date(date).toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
}

export function money(v) {
  return num(v).toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// g/ml/kg/L sont mesurables en continu (on peut peser). Les autres unités
// (pièce(s), tranche(s), paquet, boîte) ne s'achètent qu'en entier : on
// arrondit toujours vers le haut (impossible d'acheter un demi paquet).
export function roundQty(v, unit) {
  if (unit === "g" || unit === "ml") return Math.max(10, Math.round(v / 10) * 10);
  if (unit === "kg" || unit === "L") return Math.max(0.1, Math.round(v * 10) / 10);
  return Math.max(1, Math.ceil(v));
}

export const DISCRETE_UNITS = new Set(["pièce(s)", "tranche(s)", "paquet", "boîte"]);

export function portionsFor(people, childFactor) {
  const factor = Number.isFinite(childFactor) ? childFactor : CHILD_FACTOR;
  return num(people.adults) * 1 + num(people.children) * factor;
}

// Les quantités se comptent en g/ml (une portion de pâtes = 100 g), mais personne ne
// connaît le prix d'un produit au gramme : on le saisit au kg/L et on convertit.
// En interne, prix_moyen_eur reste TOUJOURS exprimé par unité de quantité (€/g pour du g),
// pour que « prix unitaire × quantité » reste valide partout.
const PRICE_UNIT = { g: { label: "kg", factor: 1000 }, ml: { label: "L", factor: 1000 } };

export function priceUnitFor(unit) {
  return PRICE_UNIT[unit] || { label: unit, factor: 1 };
}

// €/kg saisi -> €/g stocké
export function toStoredPrice(displayPrice, unit) {
  return num(displayPrice) / priceUnitFor(unit).factor;
}
// €/g stocké -> €/kg affiché
export function toDisplayPrice(storedPrice, unit) {
  return num(storedPrice) * priceUnitFor(unit).factor;
}

// Prix unitaire d'une ligne. Les lignes encodées avant l'ajout du champ `unitPrice` ne le
// portent pas : on le reconstitue depuis le total et la quantité.
export function unitPriceOf(item) {
  if (num(item?.unitPrice) > 0) return num(item.unitPrice);
  const qty = num(item?.qty);
  return qty > 0 ? num(item?.price) / qty : 0;
}

// Priorité : PriceDB exacte > catalogue exact > catalogue partiel (>=3 caractères)
export function suggestPrice(name, priceDB, catalog) {
  const n = normalize(name);
  if (!n) return null;
  if (priceDB[n]) return { price: priceDB[n].price, unit: priceDB[n].unit, source: "perso" };
  const exact = catalog.find((c) => normalize(c.nom) === n);
  if (exact) return { price: exact.prix_moyen_eur, unit: exact.unite, source: "estimation", emoji: exact.emoji };
  if (n.length >= 3) {
    const partial = catalog.find((c) => {
      const cn = normalize(c.nom);
      return n.includes(cn) || cn.includes(n);
    });
    if (partial) {
      return { price: partial.prix_moyen_eur, unit: partial.unite, source: "estimation", emoji: partial.emoji };
    }
  }
  return null;
}

// Ajout depuis le catalogue : quantité proposée pour le foyer + prix (PriceDB si connu, sinon prix moyen)
export function catalogAddCalc(item, portions, priceDB) {
  const qty = roundQty(item.base_par_portion * Math.max(portions, 1), item.unite);
  const dbEntry = priceDB[normalize(item.nom)];
  // Un prix perso n'est comparable que s'il a été relevé dans la MÊME unité : un prix
  // à la pièce multiplié par des grammes donnerait n'importe quoi.
  const usable = dbEntry && dbEntry.unit === item.unite;
  const source = usable ? "perso" : "estimation";
  const unitPrice = usable ? num(dbEntry.price) : num(item.prix_moyen_eur);
  const price = round2(unitPrice * qty);
  return { qty, unit: item.unite, unitPrice, price, source, emoji: item.emoji };
}

export function mealTotal(meal) {
  return (meal?.items || []).reduce((s, it) => s + num(it.price), 0);
}
export function dayTotal(day) {
  if (!day) return 0;
  return Object.values(day).reduce((s, m) => s + mealTotal(m), 0);
}
export function weekTotal(week) {
  if (!week) return 0;
  return Object.values(week).reduce((s, d) => s + dayTotal(d), 0);
}

export function aggregateWeek(week) {
  const map = new Map();
  for (let d = 0; d < 7; d++) {
    const day = week[d];
    if (!day) continue;
    for (const mealKey of Object.keys(day)) {
      for (const item of day[mealKey].items || []) {
        const name = (item.name || "").trim();
        if (!name) continue;
        const key = normalize(name) + "|" + item.unit;
        if (!map.has(key)) {
          map.set(key, { key, name, unit: item.unit, qty: 0, price: 0, emoji: item.emoji || "" });
        }
        const agg = map.get(key);
        agg.qty += num(item.qty);
        agg.price += num(item.price);
        if (!agg.emoji && item.emoji) agg.emoji = item.emoji;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Nom sous lequel un repas est enregistré dans la bibliothèque : la première ligne de sa
// description. Partagé entre l'enregistrement (store) et l'étoile de la carte repas, qui
// s'en sert pour savoir si le repas y figure déjà.
export function libraryNameOf(meal) {
  const firstLine = ((meal?.desc || "").split("\n")[0] || "").trim();
  return firstLine ? firstLine.slice(0, 60) : "Repas sans titre";
}

export function mealIsEmpty(meal) {
  return !(meal?.desc || "").trim() && (meal?.items || []).length === 0;
}

export function weekHasItems(week) {
  if (!week) return false;
  return Object.values(week).some((day) => Object.values(day).some((m) => (m.items || []).length > 0));
}

export function dayHasItems(day) {
  if (!day) return false;
  return Object.values(day).some((m) => (m.items || []).length > 0);
}

// Vrai si le repas `mealKey` du jour `dayDate` (Date, minuit local) est compris entre
// [start + startMeal] et [end + endMeal] inclus (granularité repas, pas seulement jour).
export function mealInRange(dayDate, mealKey, start, startMeal, end, endMeal) {
  if (dayDate < start || dayDate > end) return false;
  if (dayDate.getTime() === start.getTime() && mealIndex(mealKey) < mealIndex(startMeal)) return false;
  if (dayDate.getTime() === end.getTime() && mealIndex(mealKey) > mealIndex(endMeal)) return false;
  return true;
}

// Regroupe une liste de courses agrégée par catégorie du catalogue (ordre CATEGORY_ORDER),
// les produits inconnus du catalogue (lignes libres) vont dans "Autres".
export function groupByCategory(lines, catalog, categoryOrder) {
  const catByName = new Map(catalog.map((c) => [normalize(c.nom), c.categorie]));
  const groups = new Map(categoryOrder.map((c) => [c, []]));
  groups.set("Autres", []);
  for (const line of lines) {
    const cat = catByName.get(normalize(line.name)) || "Autres";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(line);
  }
  return Array.from(groups.entries())
    .map(([cat, items]) => ({ cat, items }))
    .filter((g) => g.items.length > 0);
}
