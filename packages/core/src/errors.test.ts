import { expect, it } from 'vitest';
import { AppError, AuthError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from './errors';

it.each([
  [AuthError, 401, 'AUTH'],
  [ForbiddenError, 403, 'FORBIDDEN'],
  [ValidationError, 400, 'VALIDATION'],
  [NotFoundError, 404, 'NOT_FOUND'],
  [ConflictError, 409, 'CONFLICT'],
] as const)('%o có status %i, code %s', (Cls, status, code) => {
  const err = new Cls('x');
  expect(err).toBeInstanceOf(AppError);
  expect(err.status).toBe(status);
  expect(err.code).toBe(code);
  expect(err.message).toBe('x');
});
