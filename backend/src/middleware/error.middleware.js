export function notFound(req, _res, next) {
  console.warn(`[404] ${req.method} ${req.originalUrl}`)
  const error = new Error('Route not found')
  error.statusCode = 404
  next(error)
}

export function errorHandler(error, _req, res, _next) {
  console.error(`[error] ${error.message}`, error.stack ?? '')
  let statusCode = error.statusCode || error.status || 500
  let message = error.message || 'Internal server error'

  if (error.name === 'ValidationError') {
    statusCode = 400
    message = Object.values(error.errors)
      .map((validationError) => validationError.message)
      .join(', ')
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400
    message = 'Attachments must be 5MB or smaller'
  }

  if (error.code === 11000) {
    statusCode = 409
    message = 'A record with those values already exists'
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  })
}
