import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@pharmacy-os/types";
import { PharmacyPlan, UserRole } from "@pharmacy-os/types";

import "../lib/i18n";

vi.mock("../lib/api", () => ({
  loginRequest: vi.fn(),
  setAccessToken: vi.fn()
}));

import { loginRequest } from "../lib/api";
import { LoginPage } from "../pages/auth/login-page";

const session: AuthSession = {
  accessToken: "access-token",
  permissions: ["dashboard:read"],
  user: {
    id: "user-1",
    email: "admin@demo.com",
    role: UserRole.OWNER,
    pharmacyId: "pharmacy-1",
    isVerified: true,
    createdAt: "2026-05-04T00:00:00.000Z"
  },
  pharmacy: {
    id: "pharmacy-1",
    name: "Sharma Medical Store",
    slug: "sharma-medical",
    licenseNo: "MH-MUM-2024-001",
    gstin: "27AABCS1429B1Z1",
    address: "Shop 12, S V Road",
    city: "Mumbai",
    state: "Maharashtra",
    pinCode: "400058",
    phone: "+919820001234",
    logoUrl: null,
    plan: PharmacyPlan.GROWTH,
    planExpiresAt: null,
    isActive: true
  }
};

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={["/auth/login"]}>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      </Routes>
    </MemoryRouter>
  );

describe("LoginForm", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(loginRequest).mockReset();
  });

  it("renders the login controls", () => {
    renderLogin();
    expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("validates invalid input before submit", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.clear(screen.getByPlaceholderText("Email address"));
    await user.type(screen.getByPlaceholderText("Email address"), "invalid-email");
    await user.clear(screen.getByPlaceholderText("Password"));
    await user.click(screen.getByRole("button", { name: "Welcome back" }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(loginRequest).not.toHaveBeenCalled();
  });

  it("submits valid credentials and redirects to dashboard", async () => {
    vi.mocked(loginRequest).mockResolvedValueOnce(session);
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Welcome back" }));

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(loginRequest).toHaveBeenCalledWith("admin@demo.com", "Demo@1234");
  });

  it("shows invalid credential errors from the API", async () => {
    vi.mocked(loginRequest).mockRejectedValueOnce(new Error("Invalid credentials"));
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Welcome back" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });
});
