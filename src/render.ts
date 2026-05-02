import type { SchemaNode } from "./infer.js";

export type ObjectMode = "strict" | "loose";

export function renderModule(
  schema: SchemaNode,
  objectMode: ObjectMode = "strict"
): string {
  return `import { z } from "zod";\n\nexport const schema = ${renderSchema(schema, 0, objectMode)};\n`;
}

export function renderSchema(
  schema: SchemaNode,
  indent = 0,
  objectMode: ObjectMode = "strict"
): string {
  let result: string;
  switch (schema.kind) {
    case "string":
      result = "z.string()";
      break;
    case "number":
      result = "z.number()";
      break;
    case "boolean":
      result = "z.boolean()";
      break;
    case "null":
      return "z.null()";
    case "unknown":
      return "z.unknown()";
    case "array":
      result = renderArray(schema, indent, objectMode);
      break;
    case "object":
      result = renderObject(schema, indent, objectMode);
      break;
  }
  if (schema.nullable) {
    result += ".nullable()";
  }
  return result;
}

function renderArray(
  schema: Extract<SchemaNode, { kind: "array" }>,
  indent: number,
  objectMode: ObjectMode
): string {
  const inner = renderSchema(schema.items, indent + 2, objectMode);
  if (inner.includes("\n")) {
    return `z.array(\n${" ".repeat(indent + 2)}${inner}\n${" ".repeat(indent)})`;
  }
  return `z.array(${inner})`;
}

function renderObject(
  schema: Extract<SchemaNode, { kind: "object" }>,
  indent: number,
  objectMode: ObjectMode
): string {
  const objectFn = objectMode === "strict" ? "z.strictObject" : "z.looseObject";

  if (schema.properties.length === 0) {
    return `${objectFn}({})`;
  }

  const baseIndent = " ".repeat(indent);
  const propertyIndent = " ".repeat(indent + 2);
  const properties = schema.properties
    .map(({ key, schema: propertySchema, optional }) => {
      let rendered = renderSchema(propertySchema, indent + 2, objectMode);
      if (optional) {
        rendered += ".optional()";
      }
      return `${propertyIndent}${renderPropertyKey(key)}: ${rendered},`;
    })
    .join("\n");

  return `${objectFn}({\n${properties}\n${baseIndent}})`;
}

function renderPropertyKey(key: string): string {
  return isValidIdentifier(key) ? key : JSON.stringify(key);
}

function isValidIdentifier(key: string): boolean {
  return /^[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*$/u.test(key);
}
