/**
 * One error type for the whole service, so the error middleware never has to
 * guess what a thrown value meant.
 */
export class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message, details) { return new ApiError(400, message, details); }
  static unauthorised(message = 'Not authenticated') { return new ApiError(401, message); }
  static forbidden(message = 'Not allowed') { return new ApiError(403, message); }
  static notFound(message = 'Not found') { return new ApiError(404, message); }
  static upstream(message, details) { return new ApiError(502, message, details); }
}

/** Wraps an async handler so a rejected promise reaches the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
