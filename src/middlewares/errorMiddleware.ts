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
  if (res.headersSent) {
    next(error);
    return;
  }

  let statusCode = res.statusCode >= 400 ? res.statusCode : 500;
  const errorStatus = error.status ?? error.statusCode;
  if (Number.isInteger(errorStatus) && errorStatus >= 400 && errorStatus <= 599) {
    statusCode = errorStatus;
  }

  let message = error.message || "Request failed";
  if (statusCode >= 500) message = "Internal Server Error";
  if (error.type === "entity.parse.failed") message = "Invalid JSON body";

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export { notFound, errorHandler };
