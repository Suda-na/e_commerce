import { Response } from 'express';
import { ApiResponse, ResponseMeta } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function successResponse<T>(
  res: Response,
  data: T,
  message?: string,
  meta?: Omit<ResponseMeta, 'timestamp' | 'requestId'>,
  statusCode: number = 200
): Response<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    meta: {
      ...meta,
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
    },
  };

  return res.status(statusCode).json(response);
}

export function successResponseWithPagination<T>(
  res: Response,
  data: T,
  page: number,
  limit: number,
  total: number,
  totalPages: number,
  message?: string,
  statusCode: number = 200
): Response<ApiResponse<T>> {
  return successResponse(res, data, message, { page, limit, total, totalPages }, statusCode);
}

export function createdResponse<T>(
  res: Response,
  data: T,
  message?: string
): Response<ApiResponse<T>> {
  return successResponse(res, data, message, undefined, 201);
}

export function noDataResponse(
  res: Response,
  message: string,
  statusCode: number = 200
): Response<ApiResponse> {
  const response: ApiResponse = {
    success: true,
    message,
    meta: {
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
    },
  };

  return res.status(statusCode).json(response);
}
