/**
 * Resource routes for file uploads, downloads, and management.
 * Includes security filters for file types and sizes.
 */

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

// Whitelist of allowed file extensions for educational resources
const ALLOWED_EXTENSIONS = new Set([
  // Documents (PDFs, Word, LibreOffice)
  ".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt",
  // Spreadsheets (Excel, LibreOffice Calc)
  ".xls", ".xlsx", ".ods", ".csv",
  // Presentations (PowerPoint, LibreOffice Impress)
  ".ppt", ".pptx", ".odp",
  // Images (for diagrams, photos, scans)
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp",
  // Video (for lectures, recordings)
  ".mp4", ".mov", ".avi", ".mkv", ".webm",
  // Audio (for podcasts, recordings)
  ".mp3", ".wav", ".ogg", ".m4a",
  // Archives (zipped assignments, code bundles)
  ".zip", ".rar", ".7z",
  // Code (for programming modules)
  ".html", ".css", ".js", ".ts", ".json", ".xml", ".py", ".java", ".c", ".cpp",
  // Notebooks (Jupyter notebooks)
  ".ipynb",
]);

// Allowed MIME type prefixes (e.g., "image/" matches "image/png", "image/jpeg", etc.)
const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "application/msword",
  "application/vnd.",          // Covers Office and ODF variants
  "text/",
  "image/",
  "video/",
  "audio/",
  "application/zip",
  "application/x-zip",
  "application/x-rar",
  "application/json",
  "application/xml",
];

// Sanitizes filenames to prevent injection attacks and path traversal
const sanitiseFilename = (original: string): string => {
  const ext = path.extname(original).toLowerCase();
  const base = path.basename(original, ext)
    .replace(/[^a-zA-Z0-9_\-. ]/g, "_") // Only keep safe characters
    .substring(0, 100);                   // Cap length to prevent padding attacks
  return `${base}${ext}`;
};

// Configure multer storage to save files with timestamps and sanitized names
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, "../../uploads")),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${sanitiseFilename(file.originalname)}`),
});

// Validates uploaded files based on extension and MIME type
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix));
  const extOk  = ALLOWED_EXTENSIONS.has(ext);

  if (mimeOk && extOk) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Permitted types: documents, spreadsheets, presentations, images, video, audio, archives, and code files.`));
  }
};

// Configure multer with storage, file size limit, and type validation
// Max 100 MB per file is reasonable for lecture recordings
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter,
});

// GET /api/resources — fetch list of resources visible to the user
router.get("/", authMiddleware, getResources);

// GET /api/resources/programmes — fetch available programme names
router.get("/programmes", authMiddleware, getProgrammeNames);

// POST /api/resources — upload a new resource file
router.post("/", authMiddleware, upload.single("file"), uploadResource);

// GET /api/resources/:id/download — download a resource file
router.get("/:id/download", authMiddleware, downloadResource);

// DELETE /api/resources/:id — delete a resource
router.delete("/:id", authMiddleware, deleteResource);

export default router;