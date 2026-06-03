export function createHttpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

export function getPagination(query) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 20)

  if (!Number.isInteger(page) || page < 1) {
    throw createHttpError(400, 'Page must be a positive integer')
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw createHttpError(400, 'Limit must be an integer between 1 and 1000')
    throw createHttpError(400, 'Limit must be an integer between 1 and 100')
  }

  return { page, limit, skip: (page - 1) * limit }
}

export function paginationResult(page, limit, total) {
  return {
    page,
    limit,
    total,
    pages: total === 0 ? 0 : Math.ceil(total / limit),
  }
}

export function getCreatedAtFilter(from, to) {
  if (!from && !to) {
    return undefined
  }

  const createdAt = {}

  if (from) {
    const date = new Date(from)
    if (Number.isNaN(date.valueOf())) {
      throw createHttpError(400, 'Invalid from date')
    }
    createdAt.$gte = date
  }

  if (to) {
    const date = new Date(to)
    if (Number.isNaN(date.valueOf())) {
      throw createHttpError(400, 'Invalid to date')
    }
    createdAt.$lte = date
  }

  if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) {
    throw createHttpError(400, 'From date must be before to date')
  }

  return createdAt
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
