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

  it("parses -n as --non-interactive", () => {
    const result = parseArgs(["node", "cli", "-n"]);
    expect(result.nonInteractive).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("parses --non-interactive", () => {
    const result = parseArgs(["node", "cli", "--non-interactive"]);
    expect(result.nonInteractive).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("parses shortcuts with long-only object mode", () => {
    const result = parseArgs(["node", "cli", "-n", "--object-mode", "strict", "-m", "nested", "-a"]);
    expect(result.nonInteractive).toBe(true);
    expect(result.objectMode).toBe("strict");
    expect(result.nestedMode).toBe("nested");
    expect(result.optionalAll).toBe(true);
  });

  it("parses -p as --optional", () => {
    const result = parseArgs(["node", "cli", "-p", "a,b.c"]);
    expect(result.optionalPaths).toEqual(new Set(["a", "b.c"]));
    expect(result.error).toBeUndefined();
  });

  it("returns an error for -p without a value", () => {
    const result = parseArgs(["node", "cli", "-p"]);
    expect(result.error).toBe("--optional requires a path argument.");
  });

  it("accepts optional paths starting with a single dash", () => {
    const result = parseArgs(["node", "cli", "-p", "-meta"]);
    expect(result.optionalPaths).toEqual(new Set(["-meta"]));
    expect(result.error).toBeUndefined();
  });

  it("parses --non-interactive with other flags", () => {
    const result = parseArgs([
      "node",
      "cli",
      "--non-interactive",
      "--object-mode=strict",
      "--nested-mode=nested",
      "--optional-all",
    ]);
    expect(result.nonInteractive).toBe(true);
    expect(result.objectMode).toBe("strict");
    expect(result.nestedMode).toBe("nested");
    expect(result.optionalAll).toBe(true);
  });

  it("parses a file path argument", () => {
    const result = parseArgs(["node", "cli", "example.json"]);
    expect(result.filePath).toBe("example.json");
    expect(result.error).toBeUndefined();
  });

  it("parses options before a file path", () => {
    const result = parseArgs(["node", "cli", "--object-mode=strict", "example.json"]);
    expect(result.objectMode).toBe("strict");
    expect(result.filePath).toBe("example.json");
    expect(result.error).toBeUndefined();
  });

  it("parses options after a file path", () => {
    const result = parseArgs(["node", "cli", "example.json", "--nested-mode=separate"]);
    expect(result.filePath).toBe("example.json");
    expect(result.nestedMode).toBe("separate");
    expect(result.error).toBeUndefined();
  });

  it("returns an error for extra positional arguments", () => {
    const result = parseArgs(["node", "cli", "a.json", "b.json"]);
    expect(result.error).toBe("Unexpected extra argument: b.json");
  });

  it("parses -o as --output", () => {
    const result = parseArgs(["node", "cli", "-o", "schema.ts"]);
    expect(result.outputPath).toBe("schema.ts");
    expect(result.error).toBeUndefined();
  });

  it("parses --output as --output", () => {
    const result = parseArgs(["node", "cli", "--output", "schema.ts"]);
    expect(result.outputPath).toBe("schema.ts");
    expect(result.error).toBeUndefined();
  });

  it("parses --output=schema.ts", () => {
    const result = parseArgs(["node", "cli", "--output=schema.ts"]);
    expect(result.outputPath).toBe("schema.ts");
    expect(result.error).toBeUndefined();
  });

  it("returns an error for --output without a value", () => {
    const result = parseArgs(["node", "cli", "--output"]);
    expect(result.error).toBe("--output requires a file path argument.");
  });

  it("returns an error for --output= without a value", () => {
    const result = parseArgs(["node", "cli", "--output="]);
    expect(result.error).toBe("--output= requires a file path argument.");
  });

  it("allows output paths starting with a dash", () => {
    const result = parseArgs(["node", "cli", "-o", "-schema.ts"]);
    expect(result.outputPath).toBe("-schema.ts");
    expect(result.error).toBeUndefined();
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
