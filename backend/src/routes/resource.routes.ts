import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getResources,
  uploadResource,
  downloadResource,
  deleteResource,
} from "../controllers/resource.controller";
import { authMiddleware } from "../middleware/auth.middleware";

// ─── Multer Storage Config ────────────────────────────────────────────────
// Files are saved to backend/uploads/ with a unique timestamped filename
// to prevent collisions if two people upload a file with the same name.

const uploadDir = path.join(__dirname, "../../uploads");

// Create the uploads folder if it doesn't exist yet
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // e.g. "1741000000000-lecture1.pdf"
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, uniqueName);
  },
});

// 50MB file size limit — adjust if needed
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ─── Routes ───────────────────────────────────────────────────────────────
const router = Router();

// Get all resources visible to the logged-in user
router.get("/", authMiddleware, getResources);

// Upload a new resource (single file, field name must be "file")
router.post("/", authMiddleware, upload.single("file"), uploadResource);

// download doesn't use authMiddleware here because the token
// comes in as a query param (?token=...) when opened via Linking.openURL
// the controller handles the token check itself
router.get("/:id/download", downloadResource);

// Delete a resource
router.delete("/:id", authMiddleware, deleteResource);

export default router;