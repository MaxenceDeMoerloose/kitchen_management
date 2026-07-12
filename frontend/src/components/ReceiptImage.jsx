import { useEffect, useState } from "react";
import { api } from "../api.js";
import { SearchIcon } from "./icons.jsx";

// Photo du ticket, cliquable pour l'agrandir en plein écran. C'est la pièce justificative :
// on doit pouvoir la relire pour vérifier une ligne douteuse.
export default function ReceiptImage({ filename, className = "" }) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e) => e.key === "Escape" && setZoomed(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  if (!filename) return null;
  const url = api.receiptImageUrl(filename);

  return (
    <>
      <button
        type="button"
        className={"receipt-photo " + className}
        onClick={() => setZoomed(true)}
        aria-label="Agrandir la photo du ticket"
      >
        <img src={url} alt="Photo du ticket" loading="lazy" />
        <span className="receipt-photo-hint">
          <SearchIcon size={14} /> Agrandir
        </span>
      </button>

      {zoomed && (
        <div className="receipt-zoom-overlay" onClick={() => setZoomed(false)} role="dialog" aria-modal="true">
          <button className="receipt-zoom-close" onClick={() => setZoomed(false)} aria-label="Fermer">
            ✕
          </button>
          <img src={url} alt="Photo du ticket agrandie" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
