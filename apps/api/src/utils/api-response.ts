import type { ApiMeta, ApiResponse, PaginatedResult } from "@pharmacy-os/types";
import type { Response } from "express";


export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = "OK",
  status = 200,
  meta?: ApiMeta
): Response<ApiResponse<T>> => res.status(status).json({ success: true, data, message, meta });

export const sendPaginated = <T>(
  res: Response,
  result: PaginatedResult<T>,
  message = "OK"
): Response<ApiResponse<T[]>> =>
  sendSuccess(res, result.data, message, 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages
  });
