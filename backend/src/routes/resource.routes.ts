import { Router } from "express";
import multer from "multer";
import path from "path";
import {
  getResources,
  uploadResource,
  downloadResource,
  deleteResource,
  getProgrammeNames,
} from "../controllers/resource.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, "../../uploads")),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/", authMiddleware, getResources);
router.get("/programmes", authMiddleware, getProgrammeNames);
router.post("/", authMiddleware, upload.single("file"), uploadResource);
router.get("/:id/download", authMiddleware, downloadResource);
router.delete("/:id", authMiddleware, deleteResource);

export default router;