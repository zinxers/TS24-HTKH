import { ApiError } from './api-client';

export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Lỗi hệ thống, vui lòng thử lại';
