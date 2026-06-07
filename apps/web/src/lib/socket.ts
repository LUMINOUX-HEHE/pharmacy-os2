import { io } from "socket.io-client";

export const createPharmacySocket = (pharmacyId: string) =>
  io("/", {
    path: "/socket.io",
    auth: { pharmacyId },
    transports: ["websocket"]
  });
