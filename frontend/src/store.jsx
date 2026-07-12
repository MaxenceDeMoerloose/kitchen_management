import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api } from "./api.js";
import { MEALS } from "./constants.js";
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
  const [profile, setProfile] = useState({ adults: 2, children: 0 });

  const [currentMonday, setCurrentMonday] = useState(() => isoLocal(mondayOf(new Date())));
  const [week, setWeek] = useState(emptyWeek);
  const [checked, setChecked] = useState({});
  const [selectedDay, setSelectedDay] = useState(() => (new Date().getDay() + 6) % 7);
  const [activeTab, setActiveTab] = useState("planning");
  const [modal, setModal] = useState(null); // { type: 'catalog' | 'library', day, mealKey }
  const [toast, setToast] = useState(null);

  const saveTimer = useRef(null);
  const skipNextWeekSave = useRef(true);

  useEffect(() => {
    (async () => {
      const [c, p, l, f, pr, w, ch] = await Promise.all([
        api.getCatalog(),
        api.getPriceDB(),
        api.getLibrary(),
        api.getFavs(),
        api.getProfile(),
        api.getWeek(currentMonday),
        api.getChecked(currentMonday),
      ]);
      setCatalog(c);
      setPriceDB(p);
      setLibrary(l);
      setFavs(f);
      setProfile(pr);
      setWeek(w);
      setChecked(ch);
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
    const [w, ch] = await Promise.all([api.getWeek(monday), api.getChecked(monday)]);
    skipNextWeekSave.current = true;
    setWeek(w);
    setChecked(ch);
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

  const portions = useMemo(() => portionsFor(profile), [profile]);

  const addFromCatalog = useCallback(
    (catalogItem) => {
      if (!modal) return;
      const { day, mealKey } = modal;
      const { qty, unit, price, source, emoji } = catalogAddCalc(catalogItem, portions, priceDB);
      addItem(day, mealKey, { id: uid(), name: catalogItem.nom, qty, unit, price, emoji, _src: source });
      showToast(`${emoji} ${catalogItem.nom} ajouté (${qty} ${unit})`);
    },
    [modal, portions, priceDB, addItem, showToast]
  );

  const toggleFav = useCallback(async (name) => {
    const next = await api.toggleFav(name);
    setFavs(next);
  }, []);

  const saveMealToLibrary = useCallback(
    async (day, mealKey) => {
      const meal = week[day][mealKey];
      if (!meal.desc.trim() && meal.items.length === 0) {
        showToast("Repas vide — rien à enregistrer");
        return;
      }
      const firstLine = (meal.desc.split("\n")[0] || "").trim();
      const name = firstLine ? firstLine.slice(0, 60) : "Repas sans titre";
      const entry = {
        id: uid(),
        name,
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

  const saveProfile = useCallback(
    async (patch) => {
      const next = { ...profile, ...patch };
      next.adults = Math.max(0, next.adults);
      next.children = Math.max(0, next.children);
      setProfile(next);
      await api.saveProfile(next);
    },
    [profile]
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
    selectedDay,
    activeTab,
    modal,
    toast,
    portions,
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
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  return useContext(Ctx);
}
