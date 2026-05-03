import { describe, expect, it } from "vitest";
import { hasNestedObjects, hasObjects, inferSchema } from "./infer.js";

describe("hasObjects", () => {
  it("returns false for primitives", () => {
    expect(hasObjects({ kind: "string" })).toBe(false);
    expect(hasObjects({ kind: "number" })).toBe(false);
    expect(hasObjects({ kind: "boolean" })).toBe(false);
    expect(hasObjects({ kind: "null" })).toBe(false);
    expect(hasObjects({ kind: "unknown" })).toBe(false);
  });

  it("returns true for objects", () => {
    expect(hasObjects({ kind: "object", properties: [] })).toBe(true);
  });

  it("returns true for nested objects in arrays", () => {
    expect(hasObjects({ kind: "array", items: { kind: "object", properties: [] } })).toBe(true);
  });

  it("returns false for arrays of primitives", () => {
    expect(hasObjects({ kind: "array", items: { kind: "string" } })).toBe(false);
  });
});

describe("hasNestedObjects", () => {
  it("returns false for primitives", () => {
    expect(hasNestedObjects({ kind: "string" })).toBe(false);
    expect(hasNestedObjects({ kind: "number" })).toBe(false);
    expect(hasNestedObjects({ kind: "boolean" })).toBe(false);
    expect(hasNestedObjects({ kind: "null" })).toBe(false);
    expect(hasNestedObjects({ kind: "unknown" })).toBe(false);
  });

  it("returns false for flat objects", () => {
    expect(
      hasNestedObjects({
        kind: "object",
        properties: [
          { key: "name", schema: { kind: "string" } },
          { key: "age", schema: { kind: "number" } },
        ],
      })
    ).toBe(false);
  });

  it("returns true for objects with nested objects", () => {
    expect(
      hasNestedObjects({
        kind: "object",
        properties: [
          { key: "name", schema: { kind: "string" } },
          {
            key: "address",
            schema: {
              kind: "object",
              properties: [{ key: "city", schema: { kind: "string" } }],
            },
          },
        ],
      })
    ).toBe(true);
  });

  it("returns true for arrays containing objects", () => {
    expect(
      hasNestedObjects({
        kind: "array",
        items: { kind: "object", properties: [] },
      })
    ).toBe(true);
  });

  it("returns false for arrays of primitives", () => {
    expect(hasNestedObjects({ kind: "array", items: { kind: "string" } })).toBe(false);
  });

  it("returns true for nested arrays with objects", () => {
    expect(
      hasNestedObjects({
        kind: "array",
        items: {
          kind: "array",
          items: { kind: "object", properties: [] },
        },
      })
    ).toBe(true);
  });
});

describe("inferSchema", () => {
  it("infers primitive JSON values", () => {
    expect(inferSchema("Ada")).toEqual({ kind: "string" });
    expect(inferSchema(42)).toEqual({ kind: "number" });
    expect(inferSchema(true)).toEqual({ kind: "boolean" });
    expect(inferSchema(null)).toEqual({ kind: "null" });
  });

  it("infers strings without format detection", () => {
    expect(inferSchema("2024-01-15")).toEqual({ kind: "string" });
    expect(inferSchema("2024-01-15T09:30:00Z")).toEqual({ kind: "string" });
    expect(inferSchema("ada@example.com")).toEqual({ kind: "string" });
    expect(inferSchema("https://example.com")).toEqual({ kind: "string" });
    expect(inferSchema("550e8400-e29b-41d4-a716-446655440000")).toEqual({ kind: "string" });
  });

  it("infers both true and false as broad boolean type", () => {
    expect(inferSchema(true)).toEqual({ kind: "boolean" });
    expect(inferSchema(false)).toEqual({ kind: "boolean" });
    expect(inferSchema([true, false, true])).toEqual({
      kind: "array",
      items: { kind: "boolean" },
    });
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

  it("infers empty arrays", () => {
    expect(inferSchema([])).toEqual({
      kind: "array",
      items: { kind: "unknown" },
    });
  });

  it("infers homogeneous primitive arrays", () => {
    expect(inferSchema(["a", "b"])).toEqual({
      kind: "array",
      items: { kind: "string" },
    });
    expect(inferSchema([1, 2, 3])).toEqual({
      kind: "array",
      items: { kind: "number" },
    });
    expect(inferSchema([true, false])).toEqual({
      kind: "array",
      items: { kind: "boolean" },
    });
    expect(inferSchema([null, null])).toEqual({
      kind: "array",
      items: { kind: "null" },
    });
  });

  it("infers mixed arrays as z.array(z.unknown())", () => {
    expect(inferSchema(["a", 1, true])).toEqual({
      kind: "array",
      items: { kind: "unknown" },
    });
    expect(inferSchema([{ id: "1" }, null, "oops"])).toEqual({
      kind: "array",
      items: { kind: "unknown" },
    });
  });

  it("infers arrays of objects merging fields across elements", () => {
    const schema = inferSchema([
      { id: "1", name: "Ada" },
      { id: "2", email: "ada@example.com" },
    ]);

    expect(schema).toEqual({
      kind: "array",
      items: {
        kind: "object",
        properties: [
          { key: "id", schema: { kind: "string" } },
          { key: "name", schema: { kind: "string" }, optional: true },
          { key: "email", schema: { kind: "string" }, optional: true },
        ],
      },
    });
  });

  it("marks missing fields in merged object arrays as optional", () => {
    const schema = inferSchema([{ a: 1 }, { b: 2 }]);

    expect(schema).toEqual({
      kind: "array",
      items: {
        kind: "object",
        properties: [
          { key: "a", schema: { kind: "number" }, optional: true },
          { key: "b", schema: { kind: "number" }, optional: true },
        ],
      },
    });
  });

  it("infers conflicting field types in merged objects as z.unknown()", () => {
    const schema = inferSchema([
      { id: "1", age: 42 },
      { id: "2", age: "unknown" },
    ]);

    expect(schema).toEqual({
      kind: "array",
      items: {
        kind: "object",
        properties: [
          { key: "id", schema: { kind: "string" } },
          { key: "age", schema: { kind: "unknown" } },
        ],
      },
    });
  });

  it("preserves merged field order by first occurrence", () => {
    const schema = inferSchema([
      { b: 1, a: 2 },
      { c: 3, b: 4 },
    ]);

    expect(schema).toEqual({
      kind: "array",
      items: {
        kind: "object",
        properties: [
          { key: "b", schema: { kind: "number" } },
          { key: "a", schema: { kind: "number" }, optional: true },
          { key: "c", schema: { kind: "number" }, optional: true },
        ],
      },
    });
  });

  it("infers nullable fields in merged objects", () => {
    const schema = inferSchema([
      { name: "Ada" },
      { name: null },
    ]);

    expect(schema).toEqual({
      kind: "array",
      items: {
        kind: "object",
        properties: [
          { key: "name", schema: { kind: "string", nullable: true } },
        ],
      },
    });
  });

  it("infers nullable and optional fields when value is null or missing", () => {
    const schema = inferSchema([
      { name: "Ada" },
      { name: null },
      {},
    ]);

    expect(schema).toEqual({
      kind: "array",
      items: {
        kind: "object",
        properties: [
          { key: "name", schema: { kind: "string", nullable: true }, optional: true },
        ],
      },
    });
  });

  it("infers homogeneous arrays with null items as nullable", () => {
    expect(inferSchema(["a", null])).toEqual({
      kind: "array",
      items: { kind: "string", nullable: true },
    });
    expect(inferSchema([1, null])).toEqual({
      kind: "array",
      items: { kind: "number", nullable: true },
    });
    expect(inferSchema([true, null])).toEqual({
      kind: "array",
      items: { kind: "boolean", nullable: true },
    });
  });

  it("infers arrays with literal null items as nullable objects when all non-null items are objects", () => {
    const schema = inferSchema([
      { id: "1" },
      null,
    ]);

    expect(schema).toEqual({
      kind: "array",
      items: {
        kind: "object",
        properties: [
          { key: "id", schema: { kind: "string" } },
        ],
        nullable: true,
      },
    });
  });

  it("preserves mixed arrays with conflicting non-null types as unknown even with null", () => {
    expect(inferSchema([1, "a", null])).toEqual({
      kind: "array",
      items: { kind: "unknown" },
    });
  });

  it("infers arrays of arrays by flattening nested items", () => {
    expect(inferSchema([[1, 2], [3, 4]])).toEqual({
      kind: "array",
      items: { kind: "array", items: { kind: "number" } },
    });
  });

  it("infers arrays of arrays with mixed inner types as unknown", () => {
    expect(inferSchema([[1, 2], ["a", "b"]])).toEqual({
      kind: "array",
      items: { kind: "array", items: { kind: "unknown" } },
    });
  });

  it("infers arrays of arrays with nullable inner items", () => {
    expect(inferSchema([[1, null], [3, 4]])).toEqual({
      kind: "array",
      items: { kind: "array", items: { kind: "number", nullable: true } },
    });
  });
});
