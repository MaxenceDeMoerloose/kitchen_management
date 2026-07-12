import { normalize } from "./utils.js";

const BASE = "/api";

async function req(path, opts) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
  return res.json();
}

export const api = {
  getCatalog: () => req("/catalog"),
  addCatalogItem: (item) => req("/catalog", { method: "POST", body: JSON.stringify(item) }),
  getWeek: (monday) => req(`/weeks/${monday}`),
  saveWeek: (monday, data) => req(`/weeks/${monday}`, { method: "PUT", body: JSON.stringify(data) }),
  getChecked: (monday) => req(`/checked/${monday}`),
  saveChecked: (monday, data) => req(`/checked/${monday}`, { method: "PUT", body: JSON.stringify(data) }),
  getPriceDB: () => req("/pricedb"),
  savePrice: (name, price, unit) =>
    req("/pricedb", { method: "PUT", body: JSON.stringify({ name: normalize(name), price, unit }) }),
  getLibrary: () => req("/library"),
  addLibrary: (entry) => req("/library", { method: "POST", body: JSON.stringify(entry) }),
  deleteLibrary: (id) => req(`/library/${id}`, { method: "DELETE" }),
  getFavs: () => req("/favs"),
  toggleFav: (name) => req("/favs/toggle", { method: "POST", body: JSON.stringify({ name }) }),
  getProfile: () => req("/profile"),
  saveProfile: (profile) => req("/profile", { method: "PUT", body: JSON.stringify(profile) }),
  getShoppingStatus: (monday) => req(`/shopping-status/${monday}`),
  saveShoppingStatus: (monday, status) =>
    req(`/shopping-status/${monday}`, { method: "PUT", body: JSON.stringify(status) }),
  getPeriods: () => req("/periods"),
  addPeriod: (period) => req("/periods", { method: "POST", body: JSON.stringify(period) }),
  deletePeriod: (id) => req(`/periods/${id}`, { method: "DELETE" }),

  getParticipants: () => req("/participants"),
  addParticipant: (p) => req("/participants", { method: "POST", body: JSON.stringify(p) }),
  updateParticipant: (id, name) => req(`/participants/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteParticipant: (id) => req(`/participants/${id}`, { method: "DELETE" }),

  scanReceipt: async (file) => {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(`${BASE}/receipts/scan`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`API error ${res.status} on /receipts/scan`);
    return res.json();
  },
  getReceipts: () => req("/receipts"),
  addReceipt: (receipt) => req("/receipts", { method: "POST", body: JSON.stringify(receipt) }),
  updateReceipt: (id, receipt) => req(`/receipts/${id}`, { method: "PUT", body: JSON.stringify(receipt) }),
  deleteReceipt: (id) => req(`/receipts/${id}`, { method: "DELETE" }),
  receiptImageUrl: (filename) => `${BASE}/receipts/image/${filename}`,

  getBalances: () => req("/balances"),
};
