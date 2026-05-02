import type { SchemaNode } from "./infer.js";

export function renderModule(schema: SchemaNode): string {
  return `import { z } from "zod";\n\nexport const schema = ${renderSchema(schema)};\n`;
}

export function renderSchema(schema: SchemaNode, indent = 0): string {
  switch (schema.kind) {
    case "string":
      return "z.string()";
    case "number":
      return "z.number()";
    case "boolean":
      return "z.boolean()";
    case "null":
      return "z.null()";
    case "object":
      return renderObject(schema, indent);
  }
}

function renderObject(schema: Extract<SchemaNode, { kind: "object" }>, indent: number): string {
  if (schema.properties.length === 0) {
    return "z.strictObject({})";
  }

  const baseIndent = " ".repeat(indent);
  const propertyIndent = " ".repeat(indent + 2);
  const properties = schema.properties
    .map(({ key, schema: propertySchema }) => {
      return `${propertyIndent}${renderPropertyKey(key)}: ${renderSchema(propertySchema, indent + 2)},`;
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
