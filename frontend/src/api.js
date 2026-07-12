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
};
