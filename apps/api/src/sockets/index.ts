import type { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export let io: Server | null = null;

export const initializeSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: [env.FRONTEND_URL, env.STOREFRONT_URL],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    const pharmacyId = typeof socket.handshake.auth.pharmacyId === "string" ? socket.handshake.auth.pharmacyId : undefined;
    if (pharmacyId) {
      void socket.join(`pharmacy:${pharmacyId}`);
      logger.debug("Socket joined pharmacy room", { socketId: socket.id, pharmacyId });
    }

    socket.on("delivery:location", (payload: { pharmacyId: string; driverId: string; lat: number; lng: number }) => {
      io?.to(`pharmacy:${payload.pharmacyId}`).emit("delivery:location", payload);
    });
  });

  return io;
};

export const emitToPharmacy = (pharmacyId: string, event: string, payload: unknown): void => {
  io?.to(`pharmacy:${pharmacyId}`).emit(event, payload);
};
