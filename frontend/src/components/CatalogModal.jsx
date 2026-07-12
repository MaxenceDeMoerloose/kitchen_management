import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store.jsx";
import { CATEGORY_ORDER, DAYS, MEALS } from "../constants.js";
import { money, normalize, roundQty, round2 } from "../utils.js";

const MEAL_LABEL = Object.fromEntries(MEALS.map((m) => [m.key, m.label]));

export default function CatalogModal() {
  const { modal, closeModal, catalog, favs, toggleFav, addFromCatalog, priceDB, portions } = useApp();
  const [search, setSearch] = useState("");

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

  const favSet = new Set(favs);
  const favItems = filtered.filter((c) => favSet.has(c.nom));
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: filtered.filter((c) => c.categorie === cat && !favSet.has(c.nom)),
  })).filter((g) => g.items.length > 0);

  function renderItem(item) {
    const isFav = favSet.has(item.nom);
    const qty = roundQty(item.base_par_portion * Math.max(portions, 1), item.unite);
    const dbEntry = priceDB[normalize(item.nom)];
    const unitPrice = dbEntry ? dbEntry.price : item.prix_moyen_eur;
    const price = round2(unitPrice * qty);
    return (
      <div className="catalog-item" key={item.nom}>
        <button className="star-btn" onClick={() => toggleFav(item.nom)} aria-label="Favori">
          {isFav ? "★" : "☆"}
        </button>
        <span className="catalog-emoji">{item.emoji}</span>
        <span className="catalog-name">
          {item.nom}
          {dbEntry && <span className="badge-perso">prix perso</span>}
        </span>
        <span className="catalog-meta">
          ≈ {qty} {item.unite} · {money(price)}
        </span>
        <button className="btn btn-primary" onClick={() => addFromCatalog(item)}>
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
        <div className="modal-body">
          {filtered.length === 0 && (
            <p className="empty-message">
              Aucun résultat pour « {search} ». Utilisez « Ligne libre » pour l'ajouter manuellement.
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
