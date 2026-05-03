import { describe, it, expect } from "vitest";
import { parseArgs } from "./cli.js";
import { inferSchema } from "./infer.js";
import { collectOptionalPaths, applyOptionalPaths } from "./paths.js";

describe("parseArgs", () => {
  it("parses --optional-all", () => {
    const result = parseArgs(["node", "cli", "--optional-all"]);
    expect(result.optionalAll).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("parses --optional with comma-separated paths", () => {
    const result = parseArgs(["node", "cli", "--optional", "a,b.c"]);
    expect(result.optionalPaths).toEqual(new Set(["a", "b.c"]));
    expect(result.error).toBeUndefined();
  });

  it("parses --optional= with comma-separated paths", () => {
    const result = parseArgs(["node", "cli", "--optional=a,b.c"]);
    expect(result.optionalPaths).toEqual(new Set(["a", "b.c"]));
    expect(result.error).toBeUndefined();
  });

  it("returns an error for --optional without a value", () => {
    const result = parseArgs(["node", "cli", "--optional"]);
    expect(result.error).toBe("--optional requires a path argument.");
  });

  it("returns an error for --optional= without a value", () => {
    const result = parseArgs(["node", "cli", "--optional="]);
    expect(result.error).toBe("--optional= requires a path argument.");
  });

  it("parses --object-mode=strict", () => {
    const result = parseArgs(["node", "cli", "--object-mode=strict"]);
    expect(result.objectMode).toBe("strict");
  });

  it("parses --object-mode loose", () => {
    const result = parseArgs(["node", "cli", "--object-mode", "loose"]);
    expect(result.objectMode).toBe("loose");
  });

  it("parses --nested-mode=nested", () => {
    const result = parseArgs(["node", "cli", "--nested-mode=nested"]);
    expect(result.nestedMode).toBe("nested");
  });

  it("returns an error for unknown flags", () => {
    const result = parseArgs(["node", "cli", "--unknown-flag"]);
    expect(result.error).toBe('Unknown option: --unknown-flag');
  });

  it("parses multiple flags together", () => {
    const result = parseArgs([
      "node",
      "cli",
      "--object-mode=loose",
      "--nested-mode=separate",
      "--optional-all",
    ]);
    expect(result.objectMode).toBe("loose");
    expect(result.nestedMode).toBe("separate");
    expect(result.optionalAll).toBe(true);
  });
});

describe("--optional-all integration", () => {
  it("marks every field as optional on a single object", () => {
    const schema = inferSchema({ a: 1, b: "hello" });
    const paths = collectOptionalPaths(schema);
    const optionalPaths = new Set(paths.map((p) => p.path));
    const final = applyOptionalPaths(schema, optionalPaths);

    expect(final).toEqual({
      kind: "object",
      properties: [
        { key: "a", schema: { kind: "number" }, optional: true },
        { key: "b", schema: { kind: "string" }, optional: true },
      ],
    });
  });

  it("marks every nested field as optional", () => {
    const schema = inferSchema({
      user: { name: "Ada", profile: { age: 30 } },
    });
    const paths = collectOptionalPaths(schema);
    const optionalPaths = new Set(paths.map((p) => p.path));
    const final = applyOptionalPaths(schema, optionalPaths);

    expect(final).toEqual({
      kind: "object",
      properties: [
        {
          key: "user",
          schema: {
            kind: "object",
            properties: [
              { key: "name", schema: { kind: "string" }, optional: true },
              {
                key: "profile",
                schema: {
                  kind: "object",
                  properties: [
                    { key: "age", schema: { kind: "number" }, optional: true },
                  ],
                },
                optional: true,
              },
            ],
          },
          optional: true,
        },
      ],
    });
  });

  it("marks every array item field as optional", () => {
    const schema = inferSchema([{ id: 1, name: "A" }]);
    const paths = collectOptionalPaths(schema);
    const optionalPaths = new Set(paths.map((p) => p.path));
    const final = applyOptionalPaths(schema, optionalPaths);

    expect(final).toEqual({
      kind: "array",
      items: {
        kind: "object",
        properties: [
          { key: "id", schema: { kind: "number" }, optional: true },
          { key: "name", schema: { kind: "string" }, optional: true },
        ],
      },
    });
  });
});
