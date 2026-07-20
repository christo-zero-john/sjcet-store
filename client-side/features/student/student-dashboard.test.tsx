import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StudentDashboard } from "./student-dashboard";

describe("student dashboard", () => {
  it("stays minimal and identifies the signed-in customer", () => {
    const markup = renderToStaticMarkup(
      <StudentDashboard
        email="student@cs.sjcetpalai.ac.in"
        notice="That workspace is restricted."
      />,
    );

    expect(markup).toContain("Student / Customer");
    expect(markup).toContain("student@cs.sjcetpalai.ac.in");
    expect(markup).toContain("That workspace is restricted.");
    expect(markup).toContain("Sign out");
    expect(markup).not.toContain("Recent orders");
    expect(markup).not.toContain("Manage inventory");
    expect(markup).not.toContain("Print queue");
  });
});
