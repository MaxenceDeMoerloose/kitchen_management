import sharp from "sharp";

// Extraction de ticket via un modèle Vision (OpenRouter, API compatible OpenAI).
// Contrairement à Tesseract (texte brut + parsing regex fragile), le modèle comprend
// directement la mise en page du ticket et renvoie du JSON structuré.

const MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-26b-a4b-it:free";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export function isOpenRouterEnabled() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

const PROMPT = `Tu analyses la photo d'un ticket de caisse (souvent Colruyt, en français ou en néerlandais).

Renvoie UNIQUEMENT un objet JSON valide, sans texte autour, sans balises markdown, au format exact :
{
  "store": "nom du magasin",
  "date": "YYYY-MM-DD",
  "items": [
    {"name": "nom de l'article", "qty": 1, "unit": "pièce(s)", "unitPrice": 1.99, "totalPrice": 1.99}
  ],
  "total": 12.34
}

Règles importantes :
- "unit" doit valoir exactement une de ces valeurs : "pièce(s)", "g", "kg", "ml", "L", "paquet", "boîte", "tranche(s)". Utilise "kg" pour les articles au poids, sinon "pièce(s)".
- "qty" est la quantité achetée (colonne Hoev./Quant.), "unitPrice" le prix unitaire (Eenheidsprijs/Prix unitaire), "totalPrice" le montant de la ligne (Bedrag/Montant).
- Inclus les lignes de remise/réduction (Korting, Réduction, bon) comme des articles avec un totalPrice NÉGATIF.
- N'inclus PAS les lignes purement informatives dont la remise est déjà comprise dans le prix affiché (celles marquées "in prijs verrekend", "déjà déduit", "Totale korting", "réduction totale").
- "total" est le montant final à payer (TE BETALEN / A PAYER).
- Si une information est illisible, fais la meilleure estimation possible plutôt que d'omettre la ligne.
- Tous les nombres doivent être des nombres JSON (point décimal), pas des chaînes.`;

function extractJson(text) {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in model response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const VALID_UNITS = new Set(["pièce(s)", "g", "kg", "ml", "L", "paquet", "boîte", "tranche(s)"]);

function sanitize(parsed) {
  const items = (Array.isArray(parsed.items) ? parsed.items : [])
    .map((it) => {
      const name = String(it.name ?? "").trim();
      if (!name) return null;
      const qty = Number(it.qty) || 1;
      const totalPrice = Number(it.totalPrice) || 0;
      const unitPrice = Number(it.unitPrice) || (qty ? totalPrice / qty : totalPrice);
      const unit = VALID_UNITS.has(it.unit) ? it.unit : "pièce(s)";
      return {
        name,
        qty,
        unit,
        unitPrice: Math.round(unitPrice * 1000) / 1000,
        totalPrice: Math.round(totalPrice * 100) / 100,
      };
    })
    .filter(Boolean);

  const date = /^\d{4}-\d{2}-\d{2}$/.test(parsed.date || "") ? parsed.date : null;
  const computed = items.reduce((s, it) => s + it.totalPrice, 0);
  const total = Number(parsed.total) || Math.round(computed * 100) / 100;

  return {
    store: String(parsed.store || "Colruyt").trim() || "Colruyt",
    date,
    items,
    total: Math.round(total * 100) / 100,
  };
}

export async function extractReceiptWithAI(buffer) {
  // Redimensionne pour limiter le poids de la requête sans perdre la lisibilité du ticket.
  const jpeg = await sharp(buffer).rotate().resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const dataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "Planificateur de repas",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty model response");

  const parsed = sanitize(extractJson(content));
  return { ...parsed, rawText: content };
}
