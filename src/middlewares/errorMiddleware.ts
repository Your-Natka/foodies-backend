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
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: error.message || "Internal Server Error",
  });
};

export { notFound, errorHandler };
