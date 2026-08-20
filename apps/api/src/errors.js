export class ApiError extends Error {
  constructor(code, message, statusCode = 500, fieldErrors = undefined) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.fieldErrors = fieldErrors;
  }
}

export const validationError = (fieldErrors, message = 'Check the submitted details.') =>
  new ApiError('VALIDATION_ERROR', message, 422, fieldErrors);

export const notFound = (message = 'The requested record was not found.') =>
  new ApiError('NOT_FOUND', message, 404);

export const forbidden = (message = 'You are not authorised to perform this action.') =>
  new ApiError('FORBIDDEN', message, 403);

export const unauthenticated = () =>
  new ApiError('AUTHENTICATION_REQUIRED', 'Please sign in to continue.', 401);
