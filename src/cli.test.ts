import { execSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parseArgs } from "./cli.js";
import { inferSchema } from "./infer.js";
import { applyOptionalPaths, collectOptionalPaths } from "./paths.js";

const CLI_PATH = resolve("dist/cli.js");

function runCLI(
  args: string[],
  stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [CLI_PATH, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data;
    });
    proc.stderr.on("data", (data) => {
      stderr += data;
    });

    proc.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });
    proc.on("error", reject);

    if (stdin !== undefined) {
      proc.stdin.write(stdin);
    }
    proc.stdin.end();
  });
}

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
    expect(result.error).toBe("Unknown option: --unknown-flag");
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
    const result = parseArgs([
      "node",
      "cli",
      "-n",
      "--object-mode",
      "strict",
      "-m",
      "nested",
      "-a",
    ]);
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
    const result = parseArgs([
      "node",
      "cli",
      "--object-mode=strict",
      "example.json",
    ]);
    expect(result.objectMode).toBe("strict");
    expect(result.filePath).toBe("example.json");
    expect(result.error).toBeUndefined();
  });

  it("parses options after a file path", () => {
    const result = parseArgs([
      "node",
      "cli",
      "example.json",
      "--nested-mode=separate",
    ]);
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

  it("returns help: true for -h", () => {
    const result = parseArgs(["node", "cli", "-h"]);
    expect(result.help).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns help: true for --help", () => {
    const result = parseArgs(["node", "cli", "--help"]);
    expect(result.help).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns an error for invalid --object-mode value", () => {
    const result = parseArgs(["node", "cli", "--object-mode=invalid"]);
    expect(result.error).toBe(
      'Invalid --object-mode: "invalid". Must be "strict" or "loose".',
    );
  });

  it("returns an error for invalid --nested-mode value", () => {
    const result = parseArgs(["node", "cli", "--nested-mode=invalid"]);
    expect(result.error).toBe(
      'Invalid --nested-mode: "invalid". Must be "nested" or "separate".',
    );
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

describe("CLI integration", () => {
  beforeAll(() => {
    // Ensure dist/cli.js is built before running integration tests
    execSync("npm run build", { cwd: process.cwd(), stdio: "ignore" });
  }, 30000);

  it("prints schema for valid JSON via stdin", async () => {
    const { stdout, stderr, exitCode } = await runCLI(
      ["-n", "--object-mode=strict", "-a"],
      '{"name":"Ada","age":36}',
    );
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toBe(
      `import { z } from "zod";\n\nconst schema = z.strictObject({\n  name: z.string().optional(),\n  age: z.number().optional(),\n});\n`,
    );
  });

  it("exits 1 for invalid JSON via stdin", async () => {
    const { stdout, stderr, exitCode } = await runCLI(
      ["-n", "--object-mode=strict", "-a"],
      "not json",
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Could not parse JSON input");
    expect(stdout).toBe("");
  });

  it("exits 1 for empty stdin", async () => {
    const { stdout, stderr, exitCode } = await runCLI(
      ["-n", "--object-mode=strict", "-a"],
      "",
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Empty input");
    expect(stdout).toBe("");
  });

  it("prints help and exits 0 for --help", async () => {
    const { stdout, stderr, exitCode } = await runCLI(["--help"]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Usage: zodify");
  });

  it("prints schema from a file", async () => {
    const { writeFileSync, unlinkSync } = require("node:fs");
    const tmpFile = resolve("tmp-test-input.json");
    writeFileSync(tmpFile, '{"id":1}', "utf-8");
    try {
      const { stdout, stderr, exitCode } = await runCLI([
        "-n",
        "--object-mode=loose",
        "-a",
        tmpFile,
      ]);
      expect(exitCode).toBe(0);
      expect(stderr).toBe("");
      expect(stdout).toBe(
        `import { z } from "zod";\n\nconst schema = z.looseObject({\n  id: z.number().optional(),\n});\n`,
      );
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it("exits 1 in non-interactive mode when required flags are missing", async () => {
    const { stdout, stderr, exitCode } = await runCLI(
      ["-n", "-a"],
      '{"name":"Ada"}',
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain(
      "--object-mode is required in non-interactive mode",
    );
    expect(stdout).toBe("");
  });
});
