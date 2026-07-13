import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api } from "./api.js";
import { MEALS, CHILD_FACTOR } from "./constants.js";
import {
  isoLocal,
  mondayOf,
  addDays,
  parseLocalDate,
  uid,
  suggestPrice,
  catalogAddCalc,
  portionsFor,
  normalize,
  roundQty,
  round2,
  num,
  weekHasItems,
  dayHasItems,
  aggregateWeek,
  mealInRange,
  libraryNameOf,
  mealIsEmpty,
} from "./utils.js";

const Ctx = createContext(null);

function emptyWeek() {
  const week = {};
  for (let d = 0; d < 7; d++) {
    week[d] = {};
    for (const m of MEALS) week[d][m.key] = { desc: "", items: [] };
  }
  return week;
}

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [priceDB, setPriceDB] = useState({});
  const [library, setLibrary] = useState([]);
  const [favs, setFavs] = useState([]);
  const [profile, setProfile] = useState({ adults: 2, children: 0, childFactor: CHILD_FACTOR });
  const [periods, setPeriods] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [balances, setBalances] = useState([]);

  const [currentMonday, setCurrentMonday] = useState(() => isoLocal(mondayOf(new Date())));
  const [week, setWeek] = useState(emptyWeek);
  const [checked, setChecked] = useState({});
  const [shoppingStatus, setShoppingStatus] = useState({ done: false, doneAt: null, doneBy: null });
  const [selectedDay, setSelectedDay] = useState(() => (new Date().getDay() + 6) % 7);
  const [activeTab, setActiveTab] = useState("planning");
  const [modal, setModal] = useState(null); // { type: 'catalog' | 'library', day, mealKey }
  const [rescaleInfo, setRescaleInfo] = useState(null); // { oldPortions, newPortions }
  const [toast, setToast] = useState(null);

  const saveTimer = useRef(null);
  const skipNextWeekSave = useRef(true);

  useEffect(() => {
    (async () => {
      const [c, p, l, f, pr, w, ch, ss, pd, parts, rec, bal] = await Promise.all([
        api.getCatalog(),
        api.getPriceDB(),
        api.getLibrary(),
        api.getFavs(),
        api.getProfile(),
        api.getWeek(currentMonday),
        api.getChecked(currentMonday),
        api.getShoppingStatus(currentMonday),
        api.getPeriods(),
        api.getParticipants(),
        api.getReceipts(),
        api.getBalances(),
      ]);
      setCatalog(c);
      setPriceDB(p);
      setLibrary(l);
      setFavs(f);
      setProfile(pr);
      setWeek(w);
      setChecked(ch);
      setShoppingStatus(ss);
      setPeriods(pd);
      setParticipants(parts);
      setReceipts(rec);
      setBalances(bal);
      skipNextWeekSave.current = true;
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipNextWeekSave.current) {
      skipNextWeekSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.saveWeek(currentMonday, week);
    }, 500);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, ready]);

  useEffect(() => {
    if (!ready || skipNextWeekSave.current) return;
    api.saveChecked(currentMonday, checked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, ready]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }, []);

  const loadWeek = useCallback(async (monday) => {
    const [w, ch, ss] = await Promise.all([api.getWeek(monday), api.getChecked(monday), api.getShoppingStatus(monday)]);
    skipNextWeekSave.current = true;
    setWeek(w);
    setChecked(ch);
    setShoppingStatus(ss);
    setCurrentMonday(monday);
  }, []);

  const goToWeek = useCallback(
    (deltaWeeks) => {
      const d = addDays(currentMonday, deltaWeeks * 7);
      loadWeek(isoLocal(mondayOf(d)));
    },
    [currentMonday, loadWeek]
  );

  const goToday = useCallback(() => {
    const today = new Date();
    loadWeek(isoLocal(mondayOf(today)));
    setSelectedDay((today.getDay() + 6) % 7);
  }, [loadWeek]);

  const selectDay = useCallback((i) => setSelectedDay(i), []);

  const updateMealDesc = useCallback((day, mealKey, desc) => {
    setWeek((w) => ({ ...w, [day]: { ...w[day], [mealKey]: { ...w[day][mealKey], desc } } }));
  }, []);

  const updateItem = useCallback((day, mealKey, id, patch) => {
    setWeek((w) => {
      const meal = w[day][mealKey];
      const items = meal.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
      return { ...w, [day]: { ...w[day], [mealKey]: { ...meal, items } } };
    });
  }, []);

  const addItem = useCallback((day, mealKey, item) => {
    setWeek((w) => {
      const meal = w[day][mealKey];
      return { ...w, [day]: { ...w[day], [mealKey]: { ...meal, items: [...meal.items, item] } } };
    });
  }, []);

  const removeItem = useCallback((day, mealKey, id) => {
    setWeek((w) => {
      const meal = w[day][mealKey];
      return { ...w, [day]: { ...w[day], [mealKey]: { ...meal, items: meal.items.filter((it) => it.id !== id) } } };
    });
  }, []);

  const addFreeLine = useCallback(
    (day, mealKey) => {
      addItem(day, mealKey, { id: uid(), name: "", qty: 1, unit: "pièce(s)", price: "", emoji: "", _src: "" });
    },
    [addItem]
  );

  const rememberPrice = useCallback((name, price, unit) => {
    const n = normalize(name);
    if (!n || !(price > 0)) return;
    setPriceDB((db) => ({ ...db, [n]: { price, unit } }));
    api.savePrice(name, price, unit);
  }, []);

  const suggest = useCallback((name) => suggestPrice(name, priceDB, catalog), [priceDB, catalog]);

  const openCatalog = useCallback((day, mealKey) => setModal({ type: "catalog", day, mealKey }), []);
  const openLibrary = useCallback((day, mealKey) => setModal({ type: "library", day, mealKey }), []);
  const closeModal = useCallback(() => setModal(null), []);

  const portions = useMemo(() => portionsFor(profile, profile.childFactor), [profile]);

  // Le foyer peut être surchargé jour par jour (week[day].people) ; sinon on retombe
  // sur le profil par défaut de l'onglet Fiche & totaux.
  const portionsForDay = useCallback(
    (day) => portionsFor(week[day]?.people || profile, profile.childFactor),
    [week, profile]
  );

  const addFromCatalog = useCallback(
    (catalogItem) => {
      if (!modal) return;
      const { day, mealKey } = modal;
      const dayPortions = portionsForDay(day);
      const { qty, unit, price, source, emoji } = catalogAddCalc(catalogItem, dayPortions, priceDB);
      addItem(day, mealKey, { id: uid(), name: catalogItem.nom, qty, unit, price, emoji, _src: source });
      showToast(`${emoji} ${catalogItem.nom} ajouté (${qty} ${unit})`);
    },
    [modal, portionsForDay, priceDB, addItem, showToast]
  );

  const addCatalogItem = useCallback(async (item) => {
    const saved = await api.addCatalogItem(item);
    setCatalog((c) => [...c.filter((x) => normalize(x.nom) !== normalize(saved.nom)), saved]);
    return saved;
  }, []);

  const toggleFav = useCallback(async (name) => {
    const next = await api.toggleFav(name);
    setFavs(next);
  }, []);

  const saveMealToLibrary = useCallback(
    async (day, mealKey) => {
      const meal = week[day][mealKey];
      if (mealIsEmpty(meal)) {
        showToast("Repas vide — rien à enregistrer");
        return;
      }
      const entry = {
        id: uid(),
        name: libraryNameOf(meal),
        mealType: mealKey,
        desc: meal.desc,
        items: meal.items.map((it) => ({ ...it, id: uid() })),
      };
      await api.addLibrary(entry);
      setLibrary((l) => [entry, ...l]);
      showToast("Repas enregistré dans la bibliothèque");
    },
    [week, showToast]
  );

  const deleteLibraryEntry = useCallback(async (id) => {
    await api.deleteLibrary(id);
    setLibrary((l) => l.filter((e) => e.id !== id));
  }, []);

  const applyLibraryEntry = useCallback(
    (entry) => {
      if (!modal) return;
      const { day, mealKey } = modal;
      setWeek((w) => ({
        ...w,
        [day]: {
          ...w[day],
          [mealKey]: { desc: entry.desc, items: entry.items.map((it) => ({ ...it, id: uid() })) },
        },
      }));
      showToast("Repas ajouté");
      closeModal();
    },
    [modal, showToast, closeModal]
  );

  const toggleChecked = useCallback((key) => {
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }, []);

  const validateShopping = useCallback(
    async (name) => {
      const doneAt = new Date().toISOString();
      const status = { done: true, doneAt, doneBy: name.trim() };
      setShoppingStatus(status);
      await api.saveShoppingStatus(currentMonday, status);
      // Marquer toutes les lignes de la liste comme prises.
      setChecked((c) => {
        const next = { ...c };
        for (const line of aggregateWeek(week)) next[line.key] = true;
        return next;
      });
      showToast("Courses marquées comme faites");
    },
    [currentMonday, week, showToast]
  );

  const reopenShopping = useCallback(async () => {
    const status = { done: false, doneAt: null, doneBy: null };
    setShoppingStatus(status);
    await api.saveShoppingStatus(currentMonday, status);
  }, [currentMonday]);

  const saveProfile = useCallback(
    async (patch) => {
      const oldPortions = portionsFor(profile, profile.childFactor);
      const next = { ...profile, ...patch };
      next.adults = Math.max(0, next.adults);
      next.children = Math.max(0, next.children);
      next.childFactor = Math.min(2, Math.max(0, Number(next.childFactor)));
      setProfile(next);
      await api.saveProfile(next);
      const newPortions = portionsFor(next, next.childFactor);
      if (newPortions !== oldPortions && weekHasItems(week)) {
        setRescaleInfo({ oldPortions, newPortions, scopeDay: null });
      }
    },
    [profile, week]
  );

  // Foyer spécifique à un jour du planning (remplace le profil par défaut pour ce jour).
  // people = null pour revenir au profil par défaut.
  const setDayProfile = useCallback(
    (day, people) => {
      const current = week[day]?.people || profile;
      const oldPortions = portionsFor(current, profile.childFactor);
      setWeek((w) => ({ ...w, [day]: { ...w[day], people } }));
      const newPortions = portionsFor(people || profile, profile.childFactor);
      if (newPortions !== oldPortions && dayHasItems(week[day])) {
        setRescaleInfo({ oldPortions, newPortions, scopeDay: day });
      }
    },
    [week, profile]
  );

  const closeRescale = useCallback(() => setRescaleInfo(null), []);

  // Réajuste les quantités (et prix, proportionnellement) des repas sélectionnés
  // après un changement de composition du foyer. selectedKeys: Set de "day|mealKey".
  const applyRescale = useCallback(
    (selectedKeys) => {
      if (!rescaleInfo || selectedKeys.size === 0) {
        setRescaleInfo(null);
        return;
      }
      const ratio = rescaleInfo.newPortions / (rescaleInfo.oldPortions || 1);
      setWeek((w) => {
        const next = { ...w };
        for (const key of selectedKeys) {
          const [day, mealKey] = key.split("|");
          const meal = next[day][mealKey];
          const items = meal.items.map((it) => {
            const qty = num(it.qty);
            if (!(qty > 0)) return it;
            const unitPrice = num(it.price) > 0 ? num(it.price) / qty : 0;
            const newQty = roundQty(qty * ratio, it.unit);
            const newPrice = unitPrice > 0 ? round2(unitPrice * newQty) : it.price;
            return { ...it, qty: newQty, price: newPrice };
          });
          next[day] = { ...next[day], [mealKey]: { ...meal, items } };
        }
        return next;
      });
      setRescaleInfo(null);
      showToast("Quantités ajustées");
    },
    [rescaleInfo, showToast]
  );

  // Total sur une période : la semaine affichée utilise l'état mémoire (le debounce
  // peut ne pas avoir encore persisté ses dernières modifications).
  const computePeriodTotal = useCallback(
    async (start, end) => {
      const startDate = parseLocalDate(start);
      const endDate = parseLocalDate(end);
      if (startDate > endDate) return null;
      const weeksResult = [];
      let total = 0;
      let daysCount = 0;
      let filledDays = 0;
      let cursor = mondayOf(startDate);
      while (cursor <= endDate) {
        const monday = isoLocal(cursor);
        const weekData = monday === currentMonday ? week : await api.getWeek(monday);
        let weekSum = 0;
        for (let d = 0; d < 7; d++) {
          const dayDate = addDays(cursor, d);
          if (dayDate < startDate || dayDate > endDate) continue;
          daysCount++;
          const dayCost = Object.values(weekData[d]).reduce(
            (s, m) => s + (m.items || []).reduce((s2, it) => s2 + (Number(it.price) || 0), 0),
            0
          );
          if (dayCost > 0) filledDays++;
          weekSum += dayCost;
        }
        if (weekSum > 0) weeksResult.push({ monday, total: weekSum });
        total += weekSum;
        cursor = addDays(cursor, 7);
      }
      return { total, daysCount, filledDays, weeks: weeksResult };
    },
    [currentMonday, week]
  );

  const addPeriod = useCallback(async (period) => {
    const entry = { id: uid(), ...period };
    await api.addPeriod(entry);
    setPeriods((p) => [...p, entry].sort((a, b) => a.startDate.localeCompare(b.startDate)));
    return entry;
  }, []);

  const deletePeriod = useCallback(async (id) => {
    await api.deletePeriod(id);
    setPeriods((p) => p.filter((x) => x.id !== id));
  }, []);

  // Liste de courses + total pour une tranche précise (jour+repas de début → jour+repas de
  // fin), potentiellement à cheval sur plusieurs semaines. Utilise l'état mémoire pour la
  // semaine affichée (debounce non encore persisté).
  const computePeriodShopping = useCallback(
    async (period) => {
      const start = parseLocalDate(period.startDate);
      const end = parseLocalDate(period.endDate);
      const map = new Map();
      let cursor = mondayOf(start);
      const lastMonday = mondayOf(end);
      while (cursor <= lastMonday) {
        const monday = isoLocal(cursor);
        const weekData = monday === currentMonday ? week : await api.getWeek(monday);
        for (let d = 0; d < 7; d++) {
          const dayDate = addDays(cursor, d);
          for (const m of MEALS) {
            if (!mealInRange(dayDate, m.key, start, period.startMeal, end, period.endMeal)) continue;
            for (const item of weekData[d][m.key].items || []) {
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
        cursor = addDays(cursor, 7);
      }
      const lines = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
      return { lines, total: lines.reduce((s, l) => s + l.price, 0) };
    },
    [currentMonday, week]
  );

  const refreshExpenses = useCallback(async () => {
    const [rec, bal] = await Promise.all([api.getReceipts(), api.getBalances()]);
    setReceipts(rec);
    setBalances(bal);
  }, []);

  const addParticipant = useCallback(
    async (name) => {
      if (!name.trim()) return;
      const p = await api.addParticipant({ id: uid(), name: name.trim() });
      setParticipants((ps) => [...ps, p]);
      await refreshExpenses();
    },
    [refreshExpenses]
  );

  const renameParticipant = useCallback(async (id, name) => {
    if (!name.trim()) return;
    await api.updateParticipant(id, name.trim());
    setParticipants((ps) => ps.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)));
  }, []);

  const deleteParticipant = useCallback(
    async (id) => {
      await api.deleteParticipant(id);
      setParticipants((ps) => ps.filter((p) => p.id !== id));
      await refreshExpenses();
    },
    [refreshExpenses]
  );

  const scanReceipt = useCallback(async (file) => api.scanReceipt(file), []);

  const saveReceipt = useCallback(
    async (receipt) => {
      await api.addReceipt(receipt);
      await refreshExpenses();
      showToast("Dépense enregistrée");
    },
    [refreshExpenses, showToast]
  );

  const updateReceiptEntry = useCallback(
    async (id, receipt) => {
      await api.updateReceipt(id, receipt);
      await refreshExpenses();
      showToast("Dépense mise à jour");
    },
    [refreshExpenses, showToast]
  );

  const deleteReceiptEntry = useCallback(
    async (id) => {
      await api.deleteReceipt(id);
      await refreshExpenses();
    },
    [refreshExpenses]
  );

  const value = {
    ready,
    catalog,
    priceDB,
    library,
    favs,
    profile,
    currentMonday,
    week,
    checked,
    shoppingStatus,
    selectedDay,
    activeTab,
    modal,
    rescaleInfo,
    toast,
    portions,
    periods,
    participants,
    receipts,
    balances,
    setActiveTab,
    selectDay,
    goToWeek,
    goToday,
    updateMealDesc,
    updateItem,
    addItem,
    removeItem,
    addFreeLine,
    rememberPrice,
    suggest,
    openCatalog,
    openLibrary,
    closeModal,
    addFromCatalog,
    toggleFav,
    saveMealToLibrary,
    deleteLibraryEntry,
    applyLibraryEntry,
    toggleChecked,
    saveProfile,
    computePeriodTotal,
    showToast,
    validateShopping,
    reopenShopping,
    closeRescale,
    applyRescale,
    portionsForDay,
    setDayProfile,
    addCatalogItem,
    addPeriod,
    deletePeriod,
    computePeriodShopping,
    addParticipant,
    renameParticipant,
    deleteParticipant,
    scanReceipt,
    saveReceipt,
    updateReceiptEntry,
    deleteReceiptEntry,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  return useContext(Ctx);
}
