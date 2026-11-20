export function notFoundHandler(request, response, next) {
  const error = new Error(`Route not found: ${request.method} ${request.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  const status = error.status ||
    (error.code === 11000 ? 409 :
      error.name === "ValidationError" || error.name === "CastError" ? 400 : 500);

  if (status >= 500) {
    console.error(error);
  }

  response.status(status).json({
    message: status >= 500
      ? "Internal server error"
      : error.code === 11000
        ? error.keyPattern && error.keyPattern.email
          ? "A record with this email already exists"
          : "A record with the same unique value already exists"
        : error.message,
  });
}
