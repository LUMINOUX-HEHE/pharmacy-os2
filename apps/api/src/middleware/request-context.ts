import crypto from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};
