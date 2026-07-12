import sharp from "sharp";

// Extraction de ticket via un modèle Vision (OpenRouter, API compatible OpenAI).
// Contrairement à Tesseract (texte brut + parsing regex fragile), le modèle comprend
// directement la mise en page du ticket et renvoie du JSON structuré.
//
// Les modèles gratuits d'OpenRouter sont fréquemment saturés (HTTP 429) : on essaie
// donc plusieurs modèles à la suite, du plus précis au moins précis, et on retombe en
// dernier recours sur l'OCR local (voir routes/receipts.js).

// Ordre établi au banc d'essai sur un vrai ticket Colruyt (12 lignes, dont 3 remises) :
//   gemma-4-31b        12/12 lignes, total juste       ← le seul sans erreur, mais souvent saturé (429)
//   nemotron-nano-12b  11/12 lignes, écart de 0,50 €
//   gemma-4-26b-a4b     8/12 lignes, écart de 6 €      ← MoE à ~4B actifs : trop faible pour un ticket
const DEFAULT_MODELS = [
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "google/gemma-4-26b-a4b-it:free",
];

// OPENROUTER_MODEL (singulier) reste prioritaire pour forcer un modèle précis.
function models() {
  const forced = process.env.OPENROUTER_MODEL?.trim();
  const list = process.env.OPENROUTER_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) || DEFAULT_MODELS;
  return forced ? [forced, ...list.filter((m) => m !== forced)] : list;
}

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export function isOpenRouterEnabled() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

const PROMPT = `Tu es un expert en lecture de tickets de caisse Colruyt (Belgique, en néerlandais ou en français).

Le tableau des articles a ces colonnes, dans cet ordre :
Art.Nr | Benaming/Désignation | Leeggoed | Hoev./Quant. | Eenheidsprijs/Prix unitaire | Bedrag/Montant

Pour CHAQUE ligne du tableau : "totalPrice" est le montant de la DERNIÈRE colonne (Bedrag),
"qty" vient de la colonne Hoev., "unitPrice" de la colonne Eenheidsprijs.

RÈGLES CRITIQUES :
1. Une ligne sans numéro d'article ET sans montant dans la colonne Bedrag est une ligne
   d'information : IGNORE-LA complètement. Notamment :
   - "Hoeveelheidsvoordeel toegekend: € X,XX (in prijs verrekend)" → remise DÉJÀ comprise dans le prix
   - "Uw totale hoeveelheidsvoordeel: € X,XX (al in totaalbedrag verrekend)"
   - "Totale korting met Xtra: € X,XX"
   - "GEWICHTSARTIKELEN" (titre de section)
   Ces lignes ne sont PAS des articles.
2. Une ligne avec un montant NÉGATIF dans la colonne Bedrag EST un article, avec un totalPrice
   négatif. Exemples : "Boni gratis product", "LEVERANCIER BON", "Korting", "Réduction". INCLUS-LES.
3. Articles au poids (section GEWICHTSARTIKELEN) : Hoev. contient un poids ("1,202 kg") et
   Eenheidsprijs vaut "2,39 EUR/kg" → qty=1.202, unit="kg", unitPrice=2.39.
4. Les nombres du ticket utilisent la virgule décimale (2,90) → convertis en nombres JSON (2.90).
5. "total" = le montant après "TE BETALEN" / "A PAYER" (surtout PAS "TOTAAL GOEDEREN",
   qui est le montant avant remises).
6. La date est en haut à gauche au format JJ/MM/AAAA → convertis en "YYYY-MM-DD".

VÉRIFICATION OBLIGATOIRE avant de répondre : la somme de tous les "totalPrice" doit être égale
à "total". Si elle ne l'est pas, c'est que tu as oublié une ligne négative ou inclus une ligne
d'information. Relis le ticket et corrige avant de répondre.

"unit" doit valoir exactement une de ces valeurs : "pièce(s)", "g", "kg", "ml", "L", "paquet",
"boîte", "tranche(s)". Utilise "kg" pour les articles au poids, sinon "pièce(s)".

Renvoie UNIQUEMENT cet objet JSON, sans texte autour, sans balises markdown :
{"store":"...","date":"YYYY-MM-DD","items":[{"name":"...","qty":1,"unit":"pièce(s)","unitPrice":1.99,"totalPrice":1.99}],"total":12.34}`;

function extractJson(text) {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in model response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const VALID_UNITS = new Set(["pièce(s)", "g", "kg", "ml", "L", "paquet", "boîte", "tranche(s)"]);

// Lignes purement informatives que les modèles les plus faibles ajoutent malgré la consigne :
// leur montant est déjà compris dans le prix des articles, les compter fausserait le total.
const INFO_LINE = /(hoeveelheidsvoordeel|in prijs verrekend|totale korting|totaal goederen|gewichtsartikelen|al in totaalbedrag|réduction totale|remise totale|total des marchandises|te betalen|à payer|a payer)/i;

function sanitize(parsed) {
  const items = (Array.isArray(parsed.items) ? parsed.items : [])
    .map((it) => {
      const name = String(it.name ?? "").trim();
      if (!name || INFO_LINE.test(name)) return null;
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
  const itemsSum = Math.round(items.reduce((s, it) => s + it.totalPrice, 0) * 100) / 100;
  const total = Number(parsed.total) || itemsSum;

  return {
    store: String(parsed.store || "Colruyt").trim() || "Colruyt",
    date,
    items,
    total: Math.round(total * 100) / 100,
    itemsSum,
  };
}

// Le garde-fou principal : si la somme des lignes ne retombe pas sur le total imprimé,
// c'est que le modèle a raté ou inventé une ligne. On ne bloque pas — on signale, et
// l'interface demande une relecture humaine avec la photo à l'appui.
function reconcile(parsed) {
  const gap = Math.round((parsed.itemsSum - parsed.total) * 100) / 100;
  const warnings = [];
  if (parsed.items.length === 0) warnings.push("Aucun article n'a été détecté sur ce ticket.");
  if (Math.abs(gap) > 0.01) {
    warnings.push(
      `La somme des lignes (${parsed.itemsSum.toFixed(2)} €) ne correspond pas au total du ticket ` +
        `(${parsed.total.toFixed(2)} €) : écart de ${gap > 0 ? "+" : ""}${gap.toFixed(2)} €. ` +
        `Une ligne a probablement été mal lue.`
    );
  }
  return { ...parsed, warnings, needsReview: warnings.length > 0 };
}

// Redimensionne pour limiter le poids de la requête sans perdre la lisibilité du ticket.
// Mesuré : passer en niveaux de gris + normalize + sharpen DÉGRADE l'extraction (le modèle
// perd des lignes). On garde donc la couleur et un JPEG peu compressé.
async function prepareImage(buffer) {
  return sharp(buffer).rotate().resize({ width: 1500, withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

async function callModel(model, dataUrl) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "Planificateur de repas",
    },
    body: JSON.stringify({
      model,
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
      // Sans plafond explicite, un ticket long peut être tronqué au milieu du JSON.
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`OpenRouter ${res.status} sur ${model}: ${body.slice(0, 200)}`);
    err.status = res.status;
    err.retryable = RETRYABLE.has(res.status);
    throw err;
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error(`réponse vide de ${model}`);
  return content;
}

// L'écart entre la somme des lignes et le total imprimé est un contrôle qualité objectif :
// un ticket bien lu retombe forcément sur ses pieds. On s'en sert pour arbitrer entre les
// modèles — une lecture incohérente ne gagne jamais contre une lecture cohérente.
const gapOf = (r) => Math.abs(r.itemsSum - r.total);

export async function extractReceiptWithAI(buffer) {
  const jpeg = await prepareImage(buffer);
  const dataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;

  const errors = [];
  let best = null;

  for (const model of models()) {
    // Une saturation du modèle est souvent passagère : on retente une fois avant de
    // passer au suivant, plutôt que de dégrader tout de suite la qualité.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const content = await callModel(model, dataUrl);
        const result = { ...reconcile(sanitize(extractJson(content))), model, rawText: content };

        // Lecture cohérente : inutile d'interroger les modèles suivants, moins bons.
        if (!result.needsReview) return result;

        // Sinon on la garde en réserve (la moins mauvaise) et on laisse sa chance au suivant.
        if (result.items.length > 0 && (!best || gapOf(result) < gapOf(best))) best = result;
        console.warn(`Lecture incohérente de ${model} (écart ${gapOf(result).toFixed(2)} €), essai du suivant.`);
        break;
      } catch (err) {
        errors.push(err.message);
        if (err.retryable && attempt === 0) {
          await sleep(1500);
          continue;
        }
        console.warn(`Modèle ${model} indisponible : ${err.message}`);
        break;
      }
    }
  }

  // Aucun modèle n'a produit de lecture cohérente : on renvoie la moins mauvaise, avec ses
  // avertissements, plutôt que de tout jeter — l'utilisateur corrigera avec la photo.
  if (best) return best;
  throw new Error(`Tous les modèles ont échoué. ${errors.slice(-3).join(" | ")}`);
}
