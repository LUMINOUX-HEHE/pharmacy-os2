import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import "../lib/i18n";
import { LoginPage } from "../pages/auth/login-page";

describe("LoginPage", () => {
  it("renders validated login controls", () => {
    const { getByPlaceholderText } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(getByPlaceholderText("Email address")).toBeInTheDocument();
    expect(getByPlaceholderText("Password")).toBeInTheDocument();
  });
});
