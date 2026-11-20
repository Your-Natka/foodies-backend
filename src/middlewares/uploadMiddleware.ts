import multer from "multer";

export const upload = multer({
  storage: multer.memoryStorage(),
  // limit image size to max 5M
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

    if (allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      const error = new Error(
        "Only JPEG, PNG and WebP images are allowed",
      ) as Error & { status: number };

      error.status = 400;
      callback(error);
    }
  },
});
