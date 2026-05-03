#!/usr/bin/env node

import { openSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { ReadStream } from "tty";
import { checkbox, select, Separator } from "@inquirer/prompts";
import { AbortPromptError, CancelPromptError, ExitPromptError } from "@inquirer/core";
import { hasNestedObjects, hasObjects, inferSchema, type JsonValue, type SchemaNode } from "./infer.js";
import { collectOptionalPaths, applyOptionalPaths } from "./paths.js";
import { renderModule, type ObjectMode, type NestedMode } from "./render.js";

const usage = `Usage: zodify [options] [file.json]
       cat response.json | zodify [options]

Options:
  -n, --non-interactive               Run without interactive prompts (requires all config flags)
      --object-mode=<strict|loose>    Object validation mode (default: strict)
  -m, --nested-mode=<nested|separate> Nested schema definition style (default: nested)
  -p, --optional <path,path,...>      Comma-separated fields to mark as optional
  -a, --optional-all                  Mark all fields as optional
  -o, --output <file>                 Write schema to file instead of stdout
  -h, --help                          Show this help message`;

export function parseArgs(argv: string[]): { objectMode?: ObjectMode; nestedMode?: NestedMode; optionalPaths?: Set<string>; optionalAll?: boolean; nonInteractive?: boolean; filePath?: string; outputPath?: string; error?: string } {
  let objectMode: ObjectMode | undefined;
  let nestedMode: NestedMode | undefined;
  const optionalPaths = new Set<string>();
  let optionalAll = false;
  let nonInteractive = false;
  let filePath: string | undefined;
  let outputPath: string | undefined;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith("--object-mode=")) {
      const value = arg.slice("--object-mode=".length);
      if (value !== "strict" && value !== "loose") {
        return { error: `Invalid --object-mode: "${value}". Must be "strict" or "loose".` };
      }
      objectMode = value;
    } else if (arg === "--object-mode") {
      const value = argv[++i];
      if (value !== "strict" && value !== "loose") {
        return { error: `Invalid --object-mode: "${value}". Must be "strict" or "loose".` };
      }
      objectMode = value;
    } else if (arg.startsWith("--nested-mode=")) {
      const value = arg.slice("--nested-mode=".length);
      if (value !== "nested" && value !== "separate") {
        return { error: `Invalid --nested-mode: "${value}". Must be "nested" or "separate".` };
      }
      nestedMode = value;
    } else if (arg === "--nested-mode" || arg === "-m") {
      const value = argv[++i];
      if (value !== "nested" && value !== "separate") {
        return { error: `Invalid --nested-mode: "${value}". Must be "nested" or "separate".` };
      }
      nestedMode = value;
    } else if (arg.startsWith("--optional=")) {
      const value = arg.slice("--optional=".length);
      if (value === "") {
        return { error: "--optional= requires a path argument." };
      }
      for (const path of value.split(",")) {
        optionalPaths.add(path);
      }
    } else if (arg === "--optional" || arg === "-p") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) {
        return { error: "--optional requires a path argument." };
      }
      for (const path of value.split(",")) {
        optionalPaths.add(path);
      }
    } else if (arg === "--optional-all" || arg === "-a") {
      optionalAll = true;
    } else if (arg === "--non-interactive" || arg === "-n") {
      nonInteractive = true;
    } else if (arg.startsWith("--output=")) {
      outputPath = arg.slice("--output=".length);
      if (outputPath === "") {
        return { error: "--output= requires a file path argument." };
      }
    } else if (arg === "--output" || arg === "-o") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) {
        return { error: "--output requires a file path argument." };
      }
      outputPath = value;
    } else if (arg === "--help" || arg === "-h") {
      return {};
    } else if (!arg.startsWith("-")) {
      if (filePath) {
        return { error: `Unexpected extra argument: ${arg}` };
      }
      filePath = arg;
    } else {
      return { error: `Unknown option: ${arg}` };
    }
  }

  return { objectMode, nestedMode, optionalPaths: optionalPaths.size > 0 ? optionalPaths : undefined, optionalAll, nonInteractive, filePath, outputPath };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function promptObjectMode(): Promise<ObjectMode> {
  const fd = openSync("/dev/tty", "r");
  const ttyInput = new ReadStream(fd);
  try {
    const answer = await select<ObjectMode>(
      {
        message: "Object mode",
        loop: false,
        choices: [
          new Separator(),
          { name: "strict", value: "strict", description: "Reject unknown keys" },
          { name: "loose", value: "loose", description: "Allow unknown keys" },
        ],
      },
      { input: ttyInput, output: process.stderr }
    );
    return answer;
  } finally {
    ttyInput.destroy();
  }
}

async function promptNestedMode(): Promise<NestedMode> {
  const fd = openSync("/dev/tty", "r");
  const ttyInput = new ReadStream(fd);
  try {
    const answer = await select<NestedMode>(
      {
        message: "Nested schemas",
        loop: false,
        choices: [
          new Separator(),
          { name: "nested", value: "nested", description: "Define schemas inline" },
          { name: "separate", value: "separate", description: "Define each nested schema as a separate export" },
        ],
      },
      { input: ttyInput, output: process.stderr }
    );
    return answer;
  } finally {
    ttyInput.destroy();
  }
}

async function promptOptionalFields(schema: SchemaNode): Promise<Set<string>> {
  const paths = collectOptionalPaths(schema);
  if (paths.length === 0) {
    return new Set();
  }

  const fd = openSync("/dev/tty", "r");
  const ttyInput = new ReadStream(fd);
  try {
    const choices = [
      new Separator(),
      ...paths.map(({ path, optional }) => ({
        name: path,
        value: path,
        checked: optional,
      })),
    ];

    const selected = await checkbox<string>(
      {
        message: `Optional fields (${paths.length} total)`,
        loop: false,
        pageSize: 15,
        choices,
      },
      { input: ttyInput, output: process.stderr }
    );
    return new Set(selected);
  } finally {
    ttyInput.destroy();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.error) {
    console.error(`Error: ${args.error}`);
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  if (!args.filePath && process.stdin.isTTY) {
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  let input: string;

  try {
    input = args.filePath ? await readFile(args.filePath, "utf-8") : await readStdin();
  } catch (error) {
    console.error(`Error: Could not read ${args.filePath ? `file "${args.filePath}"` : "stdin"}.`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  if (input.length === 0) {
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  let value: JsonValue;

  try {
    value = JSON.parse(input) as JsonValue;
  } catch (error) {
    console.error("Error: Could not parse JSON input.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const schema = inferSchema(value);

  let objectMode: ObjectMode = args.objectMode ?? "strict";
  let nestedMode: NestedMode = args.nestedMode ?? "nested";
  let optionalPaths: Set<string>;

  if (args.nonInteractive) {
    const errors: string[] = [];
    if (hasObjects(schema) && !args.objectMode) {
      errors.push("--object-mode is required in non-interactive mode");
    }
    if (hasNestedObjects(schema) && !args.nestedMode) {
      errors.push("--nested-mode is required in non-interactive mode");
    }
    const paths = collectOptionalPaths(schema);
    if (paths.length > 0 && !args.optionalPaths && !args.optionalAll) {
      errors.push("--optional or --optional-all is required in non-interactive mode");
    }
    if (errors.length > 0) {
      for (const error of errors) {
        console.error(`Error: ${error}`);
      }
      if (paths.length > 0 && !args.optionalPaths && !args.optionalAll) {
        console.error("");
        console.error("Available fields for --optional:");
        for (const { path } of paths) {
          console.error(`  ${path}`);
        }
      }
      console.error("");
      console.error(usage);
      process.exitCode = 1;
      return;
    }
    if (args.optionalPaths) {
      optionalPaths = args.optionalPaths;
    } else if (args.optionalAll) {
      optionalPaths = new Set(paths.map((p) => p.path));
    } else {
      optionalPaths = new Set();
    }
  } else {
    if (hasObjects(schema)) {
      if (!args.objectMode) {
        objectMode = await promptObjectMode();
      }
      if (hasNestedObjects(schema) && !args.nestedMode) {
        nestedMode = await promptNestedMode();
      }
    }

    if (args.optionalPaths) {
      optionalPaths = args.optionalPaths;
    } else if (args.optionalAll) {
      const paths = collectOptionalPaths(schema);
      optionalPaths = new Set(paths.map((p) => p.path));
    } else {
      optionalPaths = await promptOptionalFields(schema);
    }
  }

  const finalSchema = applyOptionalPaths(schema, optionalPaths);

  const output = renderModule(finalSchema, objectMode, nestedMode);

  if (args.outputPath) {
    await writeFile(args.outputPath, output, "utf-8");
  } else {
    console.log(output);
  }
}

main().catch((error: unknown) => {
  if (
    error instanceof CancelPromptError ||
    error instanceof AbortPromptError ||
    error instanceof ExitPromptError
  ) {
    console.error("Cancelled.");
    process.exitCode = 1;
    return;
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
