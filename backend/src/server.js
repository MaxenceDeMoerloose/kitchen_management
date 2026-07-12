import express from "express";
import cors from "cors";
import weeksRouter from "./routes/weeks.js";
import checkedRouter from "./routes/checked.js";
import pricedbRouter from "./routes/pricedb.js";
import libraryRouter from "./routes/library.js";
import favsRouter from "./routes/favs.js";
import profileRouter from "./routes/profile.js";
import catalogRouter from "./routes/catalog.js";

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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
