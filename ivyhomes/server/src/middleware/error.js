import { ApiError } from '../core/ApiError.js';
import { config } from '../config/env.js';

export const notFoundHandler = (req, _res, next) => next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity
export const errorHandler = (err, _req, res, _next) => {
  const status = err instanceof ApiError ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: {
      message: status >= 500 && config.isProd ? 'Something went wrong on our side' : err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
};
