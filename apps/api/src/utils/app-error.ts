import { ErrorCode } from "@pharmacy-os/types";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly issues?: { path: string; message: string }[];

  public constructor(
    message: string,
    statusCode = 500,
    code: ErrorCode = ErrorCode.SYSTEM_001,
    issues?: { path: string; message: string }[]
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.issues = issues;
  }
}
