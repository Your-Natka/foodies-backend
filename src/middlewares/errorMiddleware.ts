import multer from "multer";
import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";

const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  console.error("========== API ERROR ==========");
  console.error("Method:", req.method);
  console.error("URL:", req.originalUrl);
  console.error("Error:", error);
  console.error("Stack:", error.stack);
  console.error("================================");

  if (res.headersSent) {
    next(error);
    return;
  }

  let statusCode = res.statusCode >= 400 ? res.statusCode : 500;
  let message = error.message || "Request failed";

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      statusCode = 413;
      message = "File size is too large";
    } else {
      statusCode = 400;
      message = "Invalid file upload";
    }
  } else {
    const errorStatus = error.status ?? error.statusCode;

    if (
      Number.isInteger(errorStatus) &&
      errorStatus >= 400 &&
      errorStatus <= 599
    ) {
      statusCode = errorStatus;
    }

    if (error.type === "entity.parse.failed") {
      statusCode = 400;
      message = "Invalid JSON body";
    }
  }

  if (statusCode >= 500) {
    message = "Internal Server Error";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(statusCode < 500 && Array.isArray(error.errors)
      ? { errors: error.errors }
      : {}),
  });
};

export { notFound, errorHandler };
