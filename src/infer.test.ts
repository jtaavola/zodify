import { describe, expect, it } from "vitest";
import { inferSchema } from "./infer.js";

describe("inferSchema", () => {
  it("infers primitive JSON values", () => {
    expect(inferSchema("Ada")).toEqual({ kind: "string" });
    expect(inferSchema(42)).toEqual({ kind: "number" });
    expect(inferSchema(true)).toEqual({ kind: "boolean" });
    expect(inferSchema(null)).toEqual({ kind: "null" });
  });

  it("infers object properties in input order", () => {
    expect(inferSchema({ id: "123", active: true, count: 2, empty: null })).toEqual({
      kind: "object",
      properties: [
        { key: "id", schema: { kind: "string" } },
        { key: "active", schema: { kind: "boolean" } },
        { key: "count", schema: { kind: "number" } },
        { key: "empty", schema: { kind: "null" } },
      ],
    });
  });
});
