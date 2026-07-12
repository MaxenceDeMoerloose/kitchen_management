import { createWorker } from "tesseract.js";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "..", "data");

// Un seul worker Tesseract réutilisé entre les requêtes (l'initialisation est lente).
// Les tickets Colruyt sont en néerlandais (Flandre) ou en français (Wallonie/Luxembourg).
let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("nld+fra", 1, {
      cachePath: path.join(dataDir, "tessdata"),
    });
  }
  return workerPromise;
}

// Version couleur, raisonnablement compressée : conservée pour être réaffichée à l'utilisateur.
export async function saveViewableImage(buffer, outputPath) {
  await sharp(buffer).rotate().resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(outputPath);
  return outputPath;
}

// Version niveaux de gris + contraste renforcé : optimisée pour l'OCR, jetable après usage.
export async function preprocessForOcr(buffer, outputPath) {
  await sharp(buffer).rotate().resize({ width: 1600 }).grayscale().normalize().toFile(outputPath);
  return outputPath;
}

export async function extractText(imagePath) {
  const worker = await getWorker();
  const { data } = await worker.recognize(imagePath);
  return data.text;
}
