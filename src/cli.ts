#!/usr/bin/env node

import { openSync } from "fs";
import { ReadStream } from "tty";
import { select } from "@inquirer/prompts";
import { AbortPromptError, CancelPromptError, ExitPromptError } from "@inquirer/core";
import { hasObjects, inferSchema, type JsonValue } from "./infer.js";
import { renderModule, type ObjectMode } from "./render.js";

const usage = `Usage: cat response.json | zodify`;

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
  const answer = await select<ObjectMode>(
    {
      message:
        "Object mode? strict = reject unknown keys, loose = allow unknown keys",
      choices: [
        { name: "strict", value: "strict" },
        { name: "loose", value: "loose" },
      ],
    },
    { input: ttyInput, output: process.stderr }
  );
  return answer;
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

  const schema = inferSchema(value);

  let objectMode: ObjectMode = "strict";
  if (hasObjects(schema)) {
    objectMode = await promptObjectMode();
  }

  console.log(renderModule(schema, objectMode));
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
