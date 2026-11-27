export class HttpError extends Error {
  constructor(status, code, extra = undefined) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const badRequest = (code = 'BAD_REQUEST', extra) => new HttpError(400, code, extra);
export const unauthenticated = () => new HttpError(401, 'UNAUTHENTICATED');
export const forbidden = (code = 'FORBIDDEN') => new HttpError(403, code);
export const notFound = (code = 'NOT_FOUND') => new HttpError(404, code);
export const conflict = (code, extra) => new HttpError(409, code, extra);
export const unprocessable = (code, extra) => new HttpError(422, code, extra);
export const tooMany = (retryAfterSeconds) => new HttpError(429, 'RATE_LIMITED', { retryAfter: retryAfterSeconds });
