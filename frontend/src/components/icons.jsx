// Icônes au trait, dessinées sur la même grille (24×24) avec la même épaisseur : elles
// forment une paire cohérente, là où un glyphe de police (☆) et un emoji couleur (📖)
// juraient l'un à côté de l'autre.

// `size` : 20 pour un bouton-icône seul, 17 pour une icône accolée à du texte.
const base = (size) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
});

// Creuse par défaut, pleine une fois activée.
export function StarIcon({ filled = false, size = 20 }) {
  return (
    <svg {...base(size)} fill={filled ? "currentColor" : "none"}>
      <path d="M12 2.6l2.9 5.88 6.5.95-4.7 4.58 1.11 6.47L12 17.43l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.95L12 2.6z" />
    </svg>
  );
}

export function BookIcon({ size = 20 }) {
  return (
    <svg {...base(size)} fill="none">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export function TrashIcon({ size = 20 }) {
  return (
    <svg {...base(size)} fill="none">
      <path d="M3 6h18" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
      <path d="M18.5 6l-.8 13.1a1.9 1.9 0 0 1-1.9 1.8H8.2a1.9 1.9 0 0 1-1.9-1.8L5.5 6" />
      <path d="M10 10.5v6M14 10.5v6" />
    </svg>
  );
}

export function SearchIcon({ size = 20 }) {
  return (
    <svg {...base(size)} fill="none">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.9-3.9" />
    </svg>
  );
}
