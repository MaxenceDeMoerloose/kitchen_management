import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store.jsx";
import { CATEGORY_ORDER, DAYS, MEALS, UNITS } from "../constants.js";
import { StarIcon } from "./icons.jsx";
import { money, normalize, catalogAddCalc, priceUnitFor, toStoredPrice, num } from "../utils.js";

const MEAL_LABEL = Object.fromEntries(MEALS.map((m) => [m.key, m.label]));

const emptyNewItem = () => ({
  nom: "",
  categorie: CATEGORY_ORDER[0],
  unite: UNITS[0],
  prix_moyen_eur: "",
  base_par_portion: "",
  emoji: "",
});

export default function CatalogModal() {
  const { modal, closeModal, catalog, favs, toggleFav, addFromCatalog, priceDB, portionsForDay, addCatalogItem, showToast } =
    useApp();
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState(emptyNewItem);
  const portions = portionsForDay(modal.day);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeModal]);

  const q = normalize(search);
  const filtered = useMemo(
    () => catalog.filter((c) => !q || normalize(c.nom).includes(q) || normalize(c.categorie).includes(q)),
    [catalog, q]
  );

  function openAddForm() {
    setNewItem({ ...emptyNewItem(), nom: search.trim() });
    setShowAddForm(true);
  }

  // Seul le nom est vraiment indispensable. L'emoji, le prix et la quantité par portion ont
  // des valeurs de repli raisonnables : mieux vaut un produit approximatif dans le catalogue
  // qu'un produit jamais encodé parce que le formulaire bloquait.
  async function submitNewItem(e) {
    e.preventDefault();
    if (!newItem.nom.trim()) return;
    const saved = await addCatalogItem({
      ...newItem,
      nom: newItem.nom.trim(),
      emoji: newItem.emoji.trim() || "🛒",
      // Le prix est saisi au kg/L pour les produits au poids, stocké au g/ml.
      prix_moyen_eur: toStoredPrice(newItem.prix_moyen_eur, newItem.unite),
      base_par_portion: num(newItem.base_par_portion) > 0 ? num(newItem.base_par_portion) : 1,
    });
    showToast(`${saved.emoji} ${saved.nom} ajouté au catalogue`);
    setShowAddForm(false);
    setSearch(saved.nom);
  }

  const favSet = new Set(favs);
  const favItems = filtered.filter((c) => favSet.has(c.nom));
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: filtered.filter((c) => c.categorie === cat && !favSet.has(c.nom)),
  })).filter((g) => g.items.length > 0);

  function renderItem(item) {
    const isFav = favSet.has(item.nom);
    // Même calcul que l'ajout réel : l'aperçu ne peut pas mentir sur le prix.
    const { qty, price, source } = catalogAddCalc(item, portions, priceDB);
    const dbEntry = source === "perso";
    return (
      <div className="catalog-item" key={item.nom}>
        <button
          className="icon-btn"
          onClick={() => toggleFav(item.nom)}
          aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={isFav}
          title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
        >
          <StarIcon filled={isFav} />
        </button>
        <span className="catalog-emoji">{item.emoji}</span>
        <div className="catalog-info">
          <span className="catalog-name">
            {item.nom}
            {dbEntry && <span className="badge-perso">prix perso</span>}
          </span>
          <span className="catalog-meta">
            ≈ {qty} {item.unite} · {money(price)}
          </span>
        </div>
        <button className="btn btn-primary catalog-add" onClick={() => addFromCatalog(item)}>
          ＋ Ajouter
        </button>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-panel catalog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            Catalogue — {MEAL_LABEL[modal.mealKey]} ({DAYS[modal.day]})
          </h3>
          <button className="btn-icon" onClick={closeModal} aria-label="Fermer">
            ✕
          </button>
        </div>
        <input
          type="text"
          autoFocus
          className="catalog-search"
          placeholder="Rechercher un produit ou une catégorie…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="catalog-note">
          Quantités proposées pour {portions.toFixed(1).replace(".", ",")} portions · ★ = favori (affiché en
          premier)
        </p>
        {!showAddForm && (
          <button className="add-product-toggle" onClick={openAddForm}>
            ＋ Ajouter un nouveau produit au catalogue
          </button>
        )}
        {showAddForm && (
          <form className="add-product-form" onSubmit={submitNewItem}>
            <input
              type="text"
              placeholder="Nom du produit"
              value={newItem.nom}
              onChange={(e) => setNewItem((n) => ({ ...n, nom: e.target.value }))}
              autoFocus
              required
            />
            <div className="add-product-row">
              <input
                type="text"
                placeholder="Emoji"
                maxLength="4"
                value={newItem.emoji}
                onChange={(e) => setNewItem((n) => ({ ...n, emoji: e.target.value }))}
              />
              <select
                value={newItem.categorie}
                onChange={(e) => setNewItem((n) => ({ ...n, categorie: e.target.value }))}
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select value={newItem.unite} onChange={(e) => setNewItem((n) => ({ ...n, unite: e.target.value }))}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="add-product-row">
              <label>
                Prix moyen (€ / {priceUnitFor(newItem.unite).label})
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="ex : 3,17"
                  value={newItem.prix_moyen_eur}
                  onChange={(e) => setNewItem((n) => ({ ...n, prix_moyen_eur: e.target.value }))}
                />
              </label>
              <label>
                Quantité pour 1 portion ({newItem.unite})
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="1"
                  value={newItem.base_par_portion}
                  onChange={(e) => setNewItem((n) => ({ ...n, base_par_portion: e.target.value }))}
                />
              </label>
            </div>
            <p className="catalog-note add-product-hint">
              Seul le nom est obligatoire. Le prix se saisit au {priceUnitFor(newItem.unite).label}
              {priceUnitFor(newItem.unite).factor > 1 && ` (les quantités, elles, restent en ${newItem.unite})`}.
            </p>
            <div className="add-product-actions">
              <button type="button" className="btn" onClick={() => setShowAddForm(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary">
                Ajouter au catalogue
              </button>
            </div>
          </form>
        )}
        <div className="modal-body">
          {filtered.length === 0 && (
            <p className="empty-message">
              Aucun résultat pour « {search} ». Ajoutez-le au catalogue ci-dessus, ou utilisez « Ligne libre » pour
              l'ajouter manuellement à ce repas.
            </p>
          )}
          {favItems.length > 0 && (
            <div className="catalog-section">
              <h4>★ Vos favoris</h4>
              {favItems.map(renderItem)}
            </div>
          )}
          {byCategory.map((g) => (
            <div className="catalog-section" key={g.cat}>
              <h4>{g.cat}</h4>
              {g.items.map(renderItem)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
