import type { SchemaNode } from "./infer.js";

export type ObjectMode = "strict" | "loose";
export type NestedMode = "nested" | "separate";

export function renderModule(
  schema: SchemaNode,
  objectMode: ObjectMode = "strict",
  nestedMode: NestedMode = "nested",
): string {
  if (nestedMode === "nested") {
    return `import { z } from "zod";\n\nconst schema = ${renderSchema(schema, 0, objectMode, "nested")};\n`;
  }

  const nameMap = new Map<SchemaNode, string>();
  const renderedMap = new Map<string, string>();
  const usedNames = new Set<string>();

  const mainSchema = renderSchema(
    schema,
    0,
    objectMode,
    "separate",
    "",
    nameMap,
    renderedMap,
    usedNames,
  );

  let result = `import { z } from "zod";\n\n`;
  for (const [, name] of nameMap) {
    const rendered = renderedMap.get(name);
    if (rendered === undefined) {
      throw new Error(`Missing rendered schema for ${name}`);
    }
    result += `const ${name} = ${rendered};\n\n`;
  }
  result += `const schema = ${mainSchema};\n`;
  return result;
}

export function renderSchema(
  schema: SchemaNode,
  indent = 0,
  objectMode: ObjectMode = "strict",
  nestedMode: NestedMode = "nested",
  path: string = "",
  nameMap: Map<SchemaNode, string> = new Map(),
  renderedMap: Map<string, string> = new Map(),
  usedNames: Set<string> = new Set(),
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
      result = renderArray(
        schema,
        indent,
        objectMode,
        nestedMode,
        path,
        nameMap,
        renderedMap,
        usedNames,
      );
      break;
    case "object":
      if (nestedMode === "separate" && path !== "") {
        const existing = nameMap.get(schema);
        if (existing) {
          result = existing;
        } else {
          const name = generateName(path, usedNames);
          usedNames.add(name);

          const rendered = renderObject(
            schema,
            0,
            objectMode,
            nestedMode,
            path,
            nameMap,
            renderedMap,
            usedNames,
          );
          nameMap.set(schema, name);
          renderedMap.set(name, rendered);
          result = name;
        }
      } else {
        result = renderObject(
          schema,
          indent,
          objectMode,
          nestedMode,
          path,
          nameMap,
          renderedMap,
          usedNames,
        );
      }
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
  objectMode: ObjectMode,
  nestedMode: NestedMode,
  path: string,
  nameMap: Map<SchemaNode, string>,
  renderedMap: Map<string, string>,
  usedNames: Set<string>,
): string {
  const itemPath = path ? `${path}[]` : "[]";
  const inner = renderSchema(
    schema.items,
    indent + 2,
    objectMode,
    nestedMode,
    itemPath,
    nameMap,
    renderedMap,
    usedNames,
  );
  if (inner.includes("\n")) {
    return `z.array(\n${" ".repeat(indent + 2)}${inner}\n${" ".repeat(indent)})`;
  }
  return `z.array(${inner})`;
}

function renderObject(
  schema: Extract<SchemaNode, { kind: "object" }>,
  indent: number,
  objectMode: ObjectMode,
  nestedMode: NestedMode,
  path: string,
  nameMap: Map<SchemaNode, string>,
  renderedMap: Map<string, string>,
  usedNames: Set<string>,
): string {
  const objectFn = objectMode === "strict" ? "z.strictObject" : "z.looseObject";

  if (schema.properties.length === 0) {
    return `${objectFn}({})`;
  }

  const baseIndent = " ".repeat(indent);
  const propertyIndent = " ".repeat(indent + 2);
  const properties = schema.properties
    .map(({ key, schema: propertySchema, optional }) => {
      const propPath = path ? `${path}.${key}` : key;
      let rendered = renderSchema(
        propertySchema,
        indent + 2,
        objectMode,
        nestedMode,
        propPath,
        nameMap,
        renderedMap,
        usedNames,
      );
      if (optional) {
        rendered += ".optional()";
      }
      return `${propertyIndent}${renderPropertyKey(key)}: ${rendered},`;
    })
    .join("\n");

  return `${objectFn}({\n${properties}\n${baseIndent}})`;
}

function generateName(path: string, usedNames: Set<string>): string {
  const segments = path.split(".");
  const parts = segments.map((seg, i) => {
    let part: string;
    if (seg === "[]") {
      part = "Item";
    } else if (seg.endsWith("[]")) {
      part = `${pascalCase(seg.slice(0, -2))}Item`;
    } else {
      part = pascalCase(seg);
    }
    if (i === 0) {
      part = part.charAt(0).toLowerCase() + part.slice(1);
    }
    return part;
  });

  let name = `${parts.join("")}Schema`;
  if (!/^[a-zA-Z]/.test(name)) {
    name = `schema${name}`;
  }

  if (!usedNames.has(name)) return name;

  let i = 2;
  while (usedNames.has(`${name}${i}`)) i++;
  return `${name}${i}`;
}

function pascalCase(str: string): string {
  return str.replace(/(?:^|[-_])(\w)/g, (_, c: string) => c.toUpperCase());
}

function renderPropertyKey(key: string): string {
  return isValidIdentifier(key) ? key : JSON.stringify(key);
}

function isValidIdentifier(key: string): boolean {
  return /^[$_\p{ID_Start}](?:[$_\p{ID_Continue}]|\u200C|\u200D)*$/u.test(key);
}
