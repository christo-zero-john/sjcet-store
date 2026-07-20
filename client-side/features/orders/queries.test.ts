import { describe, expect, it } from "vitest";

import {
  decodeOrderCursor,
  encodeOrderCursor,
  normalizeOrderHistoryQuery,
} from "./queries";

describe("normalizeOrderHistoryQuery", () => {
  it("applies safe defaults", () => {
    const query = normalizeOrderHistoryQuery({});
    expect(query.limit).toBe(20);
    expect(query.search).toBeNull();
    expect(query.paymentMethod).toBeNull();
    expect(query.orderState).toBeNull();
  });

  it("allowlists filter values and ignores unknown ones", () => {
    const query = normalizeOrderHistoryQuery({
      paymentMethod: "online",
      orderState: "paid",
      paymentState: "not-a-real-state",
      search: "  pen  ",
    });
    expect(query.paymentMethod).toBe("online");
    expect(query.orderState).toBe("paid");
    expect(query.paymentState).toBeNull();
    expect(query.search).toBe("pen");
  });

  it("clamps the page size", () => {
    expect(normalizeOrderHistoryQuery({ limit: "500" }).limit).toBe(50);
    expect(normalizeOrderHistoryQuery({ limit: "0" }).limit).toBe(1);
    expect(normalizeOrderHistoryQuery({ limit: "abc" }).limit).toBe(20);
  });
});

describe("order cursor", () => {
  it("round-trips a created_at and id pair", () => {
    const cursor = encodeOrderCursor({
      createdAt: "2026-07-19T10:00:00.000Z",
      id: "order-1",
    });
    expect(decodeOrderCursor(cursor)).toEqual({
      createdAt: "2026-07-19T10:00:00.000Z",
      id: "order-1",
    });
  });

  it("returns null for a malformed cursor", () => {
    expect(decodeOrderCursor("!!!not-base64!!!")).toBeNull();
    expect(decodeOrderCursor(null)).toBeNull();
  });
});
