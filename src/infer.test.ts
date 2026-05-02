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
});
