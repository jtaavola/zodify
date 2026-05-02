import type { ObjectProperty, SchemaNode } from "./infer.js";

export interface OptionalPath {
  path: string;
  optional: boolean;
}

function escapeKey(key: string): string {
  return key
    .replace(/\\/g, "\\\\")
    .replace(/\./g, "\\.")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

export function collectOptionalPaths(schema: SchemaNode): OptionalPath[] {
  const paths: OptionalPath[] = [];
  walk(schema, "", paths);
  return paths;
}

function walk(schema: SchemaNode, prefix: string, paths: OptionalPath[]): void {
  if (schema.kind === "object") {
    for (const prop of schema.properties) {
      const encoded = escapeKey(prop.key);
      const path = prefix ? `${prefix}.${encoded}` : encoded;
      paths.push({ path, optional: prop.optional ?? false });
      if (prop.schema.kind === "object" || prop.schema.kind === "array") {
        walk(prop.schema, path, paths);
      }
    }
  } else if (schema.kind === "array") {
    const nextPrefix = prefix ? `${prefix}[]` : "[]";
    walk(schema.items, nextPrefix, paths);
  }
}

export function applyOptionalPaths(
  schema: SchemaNode,
  selectedPaths: Set<string>
): SchemaNode {
  return applyPaths(schema, "", selectedPaths);
}

function applyPaths(
  schema: SchemaNode,
  prefix: string,
  selectedPaths: Set<string>
): SchemaNode {
  if (schema.kind === "object") {
    const properties: ObjectProperty[] = [];
    for (const prop of schema.properties) {
      const encoded = escapeKey(prop.key);
      const path = prefix ? `${prefix}.${encoded}` : encoded;
      const optional = selectedPaths.has(path);
      const newProp: ObjectProperty = {
        key: prop.key,
        schema: applyPaths(prop.schema, path, selectedPaths),
      };
      if (optional) {
        newProp.optional = true;
      }
      properties.push(newProp);
    }
    const result: SchemaNode = { kind: "object", properties };
    if (schema.nullable) {
      result.nullable = true;
    }
    return result;
  }

  if (schema.kind === "array") {
    const nextPrefix = prefix ? `${prefix}[]` : "[]";
    const items = applyPaths(schema.items, nextPrefix, selectedPaths);
    const result: SchemaNode = { kind: "array", items };
    if (schema.nullable) {
      result.nullable = true;
    }
    return result;
  }

  return schema;
}
