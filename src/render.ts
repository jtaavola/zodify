import type { SchemaNode } from "./infer.js";

export function renderModule(schema: SchemaNode): string {
  return `import { z } from "zod";\n\nexport const schema = ${renderSchema(schema)};\n`;
}

export function renderSchema(schema: SchemaNode, indent = 0): string {
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
      result = renderArray(schema, indent);
      break;
    case "object":
      result = renderObject(schema, indent);
      break;
  }
  if (schema.nullable) {
    result += ".nullable()";
  }
  return result;
}

function renderArray(schema: Extract<SchemaNode, { kind: "array" }>, indent: number): string {
  const inner = renderSchema(schema.items, indent + 2);
  if (inner.includes("\n")) {
    return `z.array(\n${" ".repeat(indent + 2)}${inner}\n${" ".repeat(indent)})`;
  }
  return `z.array(${inner})`;
}

function renderObject(schema: Extract<SchemaNode, { kind: "object" }>, indent: number): string {
  if (schema.properties.length === 0) {
    return "z.strictObject({})";
  }

  const baseIndent = " ".repeat(indent);
  const propertyIndent = " ".repeat(indent + 2);
  const properties = schema.properties
    .map(({ key, schema: propertySchema, optional }) => {
      let rendered = renderSchema(propertySchema, indent + 2);
      if (optional) {
        rendered += ".optional()";
      }
      return `${propertyIndent}${renderPropertyKey(key)}: ${rendered},`;
    })
    .join("\n");

  return `z.strictObject({\n${properties}\n${baseIndent}})`;
}

function renderPropertyKey(key: string): string {
  return isValidIdentifier(key) ? key : JSON.stringify(key);
}

function isValidIdentifier(key: string): boolean {
  return /^[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*$/u.test(key);
}
