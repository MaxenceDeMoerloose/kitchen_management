import { useApp } from "./store.jsx";
import Header from "./components/Header.jsx";
import PlanningTab from "./components/PlanningTab.jsx";
import LibraryTab from "./components/LibraryTab.jsx";
import ShoppingTab from "./components/ShoppingTab.jsx";
import HouseholdTab from "./components/HouseholdTab.jsx";
import CatalogModal from "./components/CatalogModal.jsx";
import LibraryPickModal from "./components/LibraryPickModal.jsx";
import RescaleModal from "./components/RescaleModal.jsx";
import Toast from "./components/Toast.jsx";

export default function App() {
  const { ready, activeTab, modal, rescaleInfo } = useApp();

  if (!ready) return <div className="loading">Chargement…</div>;

  return (
    <div className="app">
      <Header />
      <main className="main">
        {activeTab === "planning" && <PlanningTab />}
        {activeTab === "courses" && <ShoppingTab />}
        {activeTab === "bibliotheque" && <LibraryTab />}
        {activeTab === "fiche" && <HouseholdTab />}
      </main>
      {modal?.type === "catalog" && <CatalogModal />}
      {modal?.type === "library" && <LibraryPickModal />}
      {rescaleInfo && <RescaleModal />}
      <Toast />
    </div>
  );
}
