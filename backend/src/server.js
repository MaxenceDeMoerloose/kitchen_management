import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import weeksRouter from "./routes/weeks.js";
import checkedRouter from "./routes/checked.js";
import pricedbRouter from "./routes/pricedb.js";
import libraryRouter from "./routes/library.js";
import favsRouter from "./routes/favs.js";
import profileRouter from "./routes/profile.js";
import catalogRouter from "./routes/catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/weeks", weeksRouter);
app.use("/api/checked", checkedRouter);
app.use("/api/pricedb", pricedbRouter);
app.use("/api/library", libraryRouter);
app.use("/api/favs", favsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/catalog", catalogRouter);

// Sert le frontend buildé (app/frontend/dist) s'il existe, pour un déploiement en un seul service.
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
