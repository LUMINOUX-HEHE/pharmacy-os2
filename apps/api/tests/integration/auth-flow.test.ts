import { expect, it } from "@jest/globals";
import request from "supertest";

import { prisma } from "../../src/config/prisma.js";
import { appPromise, describeIfDatabase } from "../helpers.js";

describeIfDatabase("auth flow", () => {
  it("registers, verifies email, completes profile, logs in, reads /me, refreshes, and logs out", async () => {
    const app = await appPromise;
    const email = `owner-${Date.now()}@demo.com`;
    await request(app).post("/api/v1/auth/register").send({ fullName: "Test Owner", email, password: "Demo@1234" }).expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    await request(app).get(`/api/v1/auth/verify-email/${user.verificationToken}`).expect(200);
    await request(app)
      .post("/api/v1/auth/complete-profile")
      .send({
        email,
        pharmacyName: `Test Pharmacy ${Date.now()}`,
        licenseNo: "MH-TEST-2026",
        gstin: "27AABCT1429B1Z1",
        phone: "+919812340001",
        pharmacyType: "Independent",
        plan: "STARTER",
        address: { street: "Test Street", city: "Mumbai", state: "Maharashtra", pinCode: "400001" }
      })
      .expect(201);

    const login = await request(app).post("/api/v1/auth/login").send({ email, password: "Demo@1234", rememberMe: true }).expect(200);
    const token = login.body.data.accessToken as string;
    expect(token).toEqual(expect.any(String));

    const me = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(me.body.data.staffRole).toBe("OWNER");

    const refresh = await request(app).post("/api/v1/auth/refresh").set("Cookie", login.headers["set-cookie"]).expect(200);
    expect(refresh.body.data.accessToken).toEqual(expect.any(String));

    await request(app).post("/api/v1/auth/logout").set("Cookie", refresh.headers["set-cookie"]).expect(200);
  });

  it("returns 401 for invalid password", async () => {
    const app = await appPromise;
    await request(app).post("/api/v1/auth/login").send({ email: "admin@demo.com", password: "Wrong@1234", rememberMe: true }).expect(401);
  });

  it("returns 401 for expired or invalid refresh token", async () => {
    const app = await appPromise;
    await request(app).post("/api/v1/auth/refresh").set("Cookie", ["refreshToken=expired.token.value"]).expect(401);
  });
});
