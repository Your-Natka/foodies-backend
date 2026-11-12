import type { RequestHandler } from "express";
import { MulterError } from "multer";
import { upload } from "./uploadMiddleware.js";

const readPhoto = upload.single("photo");

const matchesImageType = (file: Express.Multer.File) => {
  const bytes = file.buffer;
  if (file.mimetype === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.mimetype === "image/png") {
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  return file.mimetype === "image/webp" && bytes.length >= 12
    && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
};

export const uploadRecipePhoto: RequestHandler = (req, res, next) => {
  if (!req.is("multipart/form-data")) {
    res.status(415).json({ success: false, message: "Use multipart/form-data" });
    return;
  }

  readPhoto(req, res, (error: unknown) => {
    if (error) {
      const tooLarge = error instanceof MulterError && error.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({
        success: false,
        message: tooLarge ? "Photo must not exceed 5 MiB" : "Invalid multipart form",
        errors: [{ field: "photo", message: tooLarge ? "Maximum size is 5 MiB" : "Send one JPEG, PNG or WebP file as photo" }],
      });
      return;
    }
    if (!req.file || !matchesImageType(req.file)) {
      res.status(400).json({
        success: false,
        message: "Invalid recipe photo",
        errors: [{ field: "photo", message: "A JPEG, PNG or WebP image is required" }],
      });
      return;
    }
    next();
  });
};
