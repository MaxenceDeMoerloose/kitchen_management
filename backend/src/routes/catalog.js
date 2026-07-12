import { Router } from "express";
import CATALOG from "../catalog.js";

const router = Router();

router.get("/", (req, res) => res.json(CATALOG));

export default router;
