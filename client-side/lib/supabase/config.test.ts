import { describe, expect, it } from "vitest";

import { hasSupabasePublicConfig } from "./config";

describe("Supabase public configuration", () => {
  it("reports missing blank values without creating a client", () => {
    expect(
      hasSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      }),
    ).toBe(false);
  });

  it("accepts a URL and publishable key", () => {
    expect(
      hasSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
      }),
    ).toBe(true);
  });
});
