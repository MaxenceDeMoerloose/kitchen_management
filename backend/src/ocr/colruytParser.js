// Parseur de tickets Colruyt à partir du texte brut OCR (Tesseract, néerlandais/français).
//
// Format observé (Flandre en néerlandais, Wallonie/Luxembourg en français) :
//   <lettre TVA>| <n° article>|<nom du produit>   <qté>  <prix unitaire>  <montant>
//   Hoeveelheidsvoordeel toegekend:€ X (in prijs verrekend)   /  Réduction ... :€ X (déjà déduit)
//   Korting bon B123456 25%   -2,00   /   Réduction B123456 20%   -1,16
//   ...
//   FOOD INC | TOTAAL GOEDEREN | TOT LEEGGOED | TE BETALEN   (ou en français: TOTAL / A PAYER)
//   € 36,94    € 36,94   € -5,00   € 29,94
//
// L'OCR n'est jamais parfait (colonnes fusionnées, virgule lue comme espace, préfixe de
// ligne bruité par des artefacts de scan, etc.) : ce parseur privilégie la robustesse
// (toujours renvoyer le nom + le montant total de la ligne, quitte à se tromper sur la
// quantité exacte) plutôt que l'exactitude à 100% — la table de validation côté UI reste
// le vrai filet de sécurité pour corriger les erreurs résiduelles.

const DISCOUNT_KEYWORDS = /hoeveelheidsvoordeel|korting|réduction|reduction|remise|gratis|leverancier|bon\b/i;
// Remises déjà incluses dans le prix affiché (purement informatives) : à ne PAS
// recompter comme une ligne séparée sous peine de doubler la remise dans le total.
const INFO_ONLY_KEYWORDS = /verrekend|déjà déduit|deja deduit|al in totaalbedrag|totale korting|totale réduction|réduction totale|votre réduction totale/i;
const NOISE_KEYWORDS =
  /algemene verkoopsvoorwaarden|conditions generales|quality control|instituut|institut|\biban\b|swift|\brpr\b|btw-be|tva-lu|\brcs\b|ouvertur|openingsuren|kassabediende|caissier|tel\.|tél\.|\bgsm\b|gewichtsartikelen|articles au poids|leeggoed ticketnummer|vidanges|geschenkkaart|totaal betaald|totaalbedrag|teruggave|\bsaldo\b/i;
// Phrase de garantie ("nous adaptons notre prix et payons la différence") qui contient le
// mot "betalen"/"payer" mais n'est PAS la ligne de total — à exclure de sa recherche.
const PRICE_GUARANTEE_RE = /passen onze prijs|adapterons notre prix|verschil.*terug|difference/i;

function toNumber(str) {
  return Number(str.replace(/\s/g, "").replace(",", "."));
}

// Montant "strict" (virgule ou point), utilisé pour découper les lignes d'articles.
function parseStrictAmount(tok) {
  const m = tok.match(/^-?\d{1,4}[.,]\d{1,3}$/);
  return m ? toNumber(tok) : null;
}

function isNumericToken(tok) {
  return parseStrictAmount(tok) !== null || /^\d{1,3}$/.test(tok);
}

// Montants "tolérants" (la virgule est parfois lue comme un espace par l'OCR), utilisés
// uniquement pour repérer le total final au milieu de bruit.
function extractLooseAmounts(line) {
  const out = [];
  const re = /(-?\d{1,4})[.,\s](\d{2})(?!\d)/g;
  let m;
  while ((m = re.exec(line))) {
    out.push(Number(`${m[1]}.${m[2]}`));
  }
  return out;
}

function cleanName(name) {
  return name
    .replace(/[|@[\]]/g, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Ligne d'article : une lettre (code TVA), un peu de bruit éventuel, un n° d'article de
// 4 à 7 chiffres, puis le nom + jusqu'à 3 nombres en fin de ligne (qté, prix unit., total).
// Le préfixe est très bruité par l'OCR ("A|", "a|", "Ja]", "== A|"...) d'où une détection
// tolérante plutôt qu'un ancrage strict en début de ligne.
const ITEM_PREFIX_RE = /[A-Za-z][^\dA-Za-z\n]{0,3}(\d{4,7})[^\dA-Za-z\n]{0,3}(.+)$/;

function parseItemLine(line) {
  const m = line.match(ITEM_PREFIX_RE);
  if (!m) return null;
  const rest = m[2].trim();
  const tokens = rest.split(/\s+/);

  const numericPositions = [];
  tokens.forEach((tok, i) => {
    if (isNumericToken(tok)) numericPositions.push(i);
  });
  if (numericPositions.length === 0) return null;

  const trailing = numericPositions.slice(-3);
  const nameEnd = trailing[0];
  const values = trailing.map((i) => parseStrictAmount(tokens[i]) ?? Number(tokens[i]));

  let qty = 1;
  let unitPrice;
  let totalPrice;
  if (values.length >= 2) {
    totalPrice = values[values.length - 1];
    unitPrice = values[values.length - 2];
    if (values.length === 3 && values[0] > 0) qty = values[0];
  } else {
    totalPrice = values[0];
    unitPrice = totalPrice;
  }

  const name = cleanName(tokens.slice(0, nameEnd).join(" "));
  if (!name || name.length < 2) return null;

  const unit = /\bkg\b/i.test(rest) ? "kg" : "pièce(s)";

  return { name, qty, unit, unitPrice, totalPrice };
}

// Ligne de remise/promo sans n° d'article, mais avec un montant en fin de ligne.
function parseDiscountLine(line) {
  if (!DISCOUNT_KEYWORDS.test(line)) return null;
  const amounts = extractLooseAmounts(line);
  if (amounts.length === 0) return null;
  const amount = amounts[amounts.length - 1];
  if (amount === 0) return null;
  const name = cleanName(line.replace(/^[^A-Za-zÀ-ÿ]*/, "").replace(/[-\d.,€%\s]+$/, ""));
  return { name: `Remise — ${name || "réduction"}`, qty: 1, unit: "pièce(s)", unitPrice: amount, totalPrice: amount };
}

// Le mot "betalen"/"payer" apparaît parfois dans une phrase commerciale en haut du ticket
// ("... et payons la différence") avant la vraie ligne de total en bas : on prend donc la
// DERNIÈRE occurrence, pas la première.
function extractTotal(lines) {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (PRICE_GUARANTEE_RE.test(lines[i])) continue;
    if (/betalen|a payer|à payer/i.test(lines[i])) idx = i;
  }
  if (idx === -1) return null;
  for (let i = idx; i < Math.min(idx + 2, lines.length); i++) {
    const amounts = extractLooseAmounts(lines[i]);
    if (amounts.length > 0) return amounts[amounts.length - 1];
  }
  return null;
}

function extractDate(text) {
  const m = text.match(/(\d{2,4})[/.](\d{2})[/.](\d{2,4})/);
  if (!m) return null;
  const [, a, b, c] = m;
  let year, month, day;
  if (a.length === 4) {
    year = a;
    month = b;
    day = c;
  } else {
    day = a;
    month = b;
    year = c.length === 2 ? `20${c}` : c;
  }
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function extractStore(text) {
  return /colruy/i.test(text) ? "Colruyt" : "Ticket de caisse";
}

export function parseReceipt(rawText) {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const items = [];
  for (const line of lines) {
    if (NOISE_KEYWORDS.test(line) || INFO_ONLY_KEYWORDS.test(line)) continue;
    const preferDiscount = DISCOUNT_KEYWORDS.test(line);
    const item = preferDiscount
      ? parseDiscountLine(line) || parseItemLine(line)
      : parseItemLine(line) || parseDiscountLine(line);
    if (item) items.push(item);
  }

  const total = extractTotal(lines);
  const computedTotal = items.reduce((s, it) => s + it.totalPrice, 0);

  return {
    store: extractStore(rawText),
    date: extractDate(rawText),
    items,
    total: total ?? Math.round(computedTotal * 100) / 100,
    rawText,
  };
}
