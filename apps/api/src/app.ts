import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";

const helmetMiddleware = helmet;
import morgan from "morgan";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

import { env, isProduction } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { generalRateLimiter } from "./middleware/rate-limiter.js";
import { requestContext } from "./middleware/request-context.js";
import { analyticsRouter } from "./modules/analytics/index.js";
import { authRouter } from "./modules/auth/index.js";
import { billingRouter } from "./modules/billing/index.js";
import { customersRouter } from "./modules/customers/index.js";
import { deliveryRouter } from "./modules/delivery/index.js";
import { distributorsRouter } from "./modules/distributors/index.js";
import { inventoryRouter } from "./modules/inventory/index.js";
import { notificationsRouter } from "./modules/notifications/index.js";
import { ordersRouter } from "./modules/orders/index.js";
import { pharmacyRouter } from "./modules/pharmacy/index.js";
import { remindersRouter } from "./modules/reminders/index.js";
import { settingsRouter } from "./modules/settings/index.js";
import { storefrontRouter } from "./modules/storefront/index.js";
import { uploadsRouter } from "./modules/uploads/index.js";
import { webhooksRouter } from "./modules/webhooks/index.js";

export const createApp = (): express.Express => {
  const app = express();
  const allowedOrigins = new Set([env.FRONTEND_URL, env.STOREFRONT_URL]);

  app.use(requestContext);
  app.use(
    helmetMiddleware({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"]
            }
          }
        : false,
      hsts: isProduction
    })
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS origin blocked"));
      },
      credentials: true
    })
  );
  app.use("/api/v1/webhooks/razorpay", express.raw({ type: "application/json", limit: "1mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));
  app.use(generalRateLimiter);

  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Pharmacy OS API",
        version: "1.0.0",
        description: "OpenAPI surface for Pharmacy OS SaaS backend."
      },
      servers: [{ url: "/api/v1" }],
      security: [{ bearerAuth: [] }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        },
        schemas: {
          ApiResponse: {
            type: "object",
            required: ["success", "data", "message"],
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "object", nullable: true },
              message: { type: "string" },
              meta: { type: "object" }
            }
          },
          ErrorResponse: {
            type: "object",
            required: ["success", "data", "message", "code"],
            properties: {
              success: { type: "boolean", example: false },
              data: { nullable: true, example: null },
              message: { type: "string" },
              code: {
                type: "string",
                enum: [
                  "AUTH_001",
                  "AUTH_002",
                  "AUTH_003",
                  "INV_001",
                  "INV_002",
                  "BILL_001",
                  "BILL_002",
                  "ORDER_001",
                  "CUSTOMER_001",
                  "VALIDATION_001",
                  "SYSTEM_001"
                ]
              },
              meta: { type: "object" }
            }
          },
          LoginRequest: {
            type: "object",
            required: ["email", "password"],
            properties: {
              email: { type: "string", format: "email" },
              password: { type: "string", format: "password" },
              rememberMe: { type: "boolean", default: true }
            }
          },
          MedicineInput: {
            type: "object",
            required: ["name", "genericName", "category", "manufacturer", "batchNo", "expiryDate", "mfgDate", "mrp", "purchasePrice", "gstRate", "hsnCode", "stockQty", "reorderLevel"],
            properties: {
              name: { type: "string" },
              genericName: { type: "string" },
              sku: { type: "string" },
              category: { type: "string", enum: ["TABLET", "CAPSULE", "SYRUP", "INJECTION", "CREAM", "OINTMENT", "DROPS", "INHALER", "DEVICE", "SUPPLEMENT"] },
              manufacturer: { type: "string" },
              batchNo: { type: "string" },
              expiryDate: { type: "string", format: "date-time" },
              mfgDate: { type: "string", format: "date-time" },
              mrp: { type: "integer", description: "Paise" },
              purchasePrice: { type: "integer", description: "Paise" },
              gstRate: { type: "integer", enum: [5, 12, 18] },
              hsnCode: { type: "string" },
              stockQty: { type: "integer" },
              reorderLevel: { type: "integer" }
            }
          },
          CreateBillRequest: {
            type: "object",
            required: ["paymentMode", "items"],
            properties: {
              patientName: { type: "string", nullable: true },
              patientPhone: { type: "string", nullable: true },
              doctorName: { type: "string", nullable: true },
              prescriptionUrl: { type: "string", nullable: true },
              paymentMode: { type: "string", enum: ["CASH", "UPI", "CARD", "CREDIT"] },
              discount: { type: "number", minimum: 0, maximum: 100 },
              idempotencyKey: { type: "string", format: "uuid" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  required: ["medicineId", "quantity"],
                  properties: {
                    medicineId: { type: "string" },
                    quantity: { type: "integer", minimum: 1 },
                    discount: { type: "number", minimum: 0, maximum: 100 }
                  }
                }
              }
            }
          },
          CustomerInput: {
            type: "object",
            required: ["name", "phone"],
            properties: {
              name: { type: "string" },
              phone: { type: "string" },
              email: { type: "string", format: "email", nullable: true },
              address: { type: "string", nullable: true },
              tags: { type: "array", items: { type: "string" } },
              birthday: { type: "string", format: "date-time", nullable: true }
            }
          }
        },
        responses: {
          Unauthorized: {
            description: "Missing, invalid, expired, or insufficient authentication.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          },
          ValidationError: {
            description: "Input validation failed.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          },
          NotFound: {
            description: "Requested resource was not found.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          }
        }
      },
      paths: {
        "/auth/login": {
          post: {
            tags: ["Auth"],
            security: [],
            summary: "Login and set refresh-token cookie",
            requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } },
            responses: {
              "200": { description: "Authenticated session", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiResponse" } } } },
              "401": { $ref: "#/components/responses/Unauthorized" },
              "400": { $ref: "#/components/responses/ValidationError" }
            }
          }
        },
        "/inventory": {
          get: {
            tags: ["Inventory"],
            summary: "List medicines with filters, search, sort, and pagination",
            parameters: [
              { name: "search", in: "query", schema: { type: "string" } },
              { name: "category", in: "query", schema: { type: "string" } },
              { name: "manufacturer", in: "query", schema: { type: "string" } },
              { name: "stockStatus", in: "query", schema: { type: "string", enum: ["in_stock", "low_stock", "out_of_stock"] } },
              { name: "expiryStatus", in: "query", schema: { type: "string" } },
              { name: "page", in: "query", schema: { type: "integer" } },
              { name: "limit", in: "query", schema: { type: "integer" } }
            ],
            responses: { "200": { description: "Paginated inventory" }, "401": { $ref: "#/components/responses/Unauthorized" } }
          },
          post: {
            tags: ["Inventory"],
            summary: "Create a medicine",
            requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/MedicineInput" } } } },
            responses: { "201": { description: "Medicine created" }, "400": { $ref: "#/components/responses/ValidationError" } }
          }
        },
        "/billing/bills": {
          post: {
            tags: ["Billing"],
            summary: "Create a bill, deduct stock atomically, and queue reorder checks",
            requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateBillRequest" } } } },
            responses: {
              "201": { description: "Bill created with items" },
              "409": { description: "Insufficient stock", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
            }
          }
        },
        "/customers": {
          get: { tags: ["Customers"], summary: "List customers with CRM metrics", responses: { "200": { description: "Paginated customers" } } },
          post: {
            tags: ["Customers"],
            summary: "Create a customer",
            requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CustomerInput" } } } },
            responses: { "201": { description: "Customer created" } }
          }
        },
        "/orders/{id}/status": {
          put: {
            tags: ["Orders"],
            summary: "Advance an order through the validated status flow",
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "Order updated" }, "409": { description: "Invalid transition" } }
          }
        },
        "/analytics/revenue": {
          get: {
            tags: ["Analytics"],
            summary: "Revenue time series from bills",
            parameters: [
              { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
              { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } },
              { name: "groupBy", in: "query", schema: { type: "string", enum: ["day", "week", "month"] } }
            ],
            responses: { "200": { description: "Revenue series" } }
          }
        }
      }
    },
    apis: ["./src/modules/**/*.ts"]
  });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const api = Router();
  api.use("/auth", authRouter);
  api.use("/pharmacy", pharmacyRouter);
  api.use("/inventory", inventoryRouter);
  api.use("/billing", billingRouter);
  api.use("/orders", ordersRouter);
  api.use("/store", storefrontRouter);
  api.use("/customers", customersRouter);
  api.use("/reminders", remindersRouter);
  api.use(distributorsRouter);
  api.use("/analytics", analyticsRouter);
  api.use("/delivery", deliveryRouter);
  api.use("/settings", settingsRouter);
  api.use("/uploads", uploadsRouter);
  api.use("/webhooks", webhooksRouter);
  api.use("/notifications", notificationsRouter);

  app.use("/api/v1", api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();

export default app;
