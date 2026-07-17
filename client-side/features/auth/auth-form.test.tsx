import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuthForm } from "./auth-form";

describe("authentication form", () => {
  it("renders login and signup on one authentication surface", () => {
    const markup = renderToStaticMarkup(<AuthForm />);

    expect(markup).toContain("Welcome back");
    expect(markup).toContain("Sign up");
    expect(markup).toContain('type="email"');
    expect(markup).toContain('type="password"');
  });
});
