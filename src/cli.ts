#!/usr/bin/env node

import { inferSchema, type JsonValue } from "./infer.js";
import { renderModule } from "./render.js";

const usage = `Usage: cat response.json | zodify`;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  if (process.stdin.isTTY) {
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  const input = await readStdin();

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

  console.log(renderModule(inferSchema(value)));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
