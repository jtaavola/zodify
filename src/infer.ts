export type SchemaNode =
  | { kind: "string"; nullable?: boolean }
  | { kind: "number"; nullable?: boolean }
  | { kind: "boolean"; nullable?: boolean }
  | { kind: "null"; nullable?: boolean }
  | { kind: "unknown"; nullable?: boolean }
  | { kind: "array"; items: SchemaNode; nullable?: boolean }
  | { kind: "object"; properties: ObjectProperty[]; nullable?: boolean };

export interface ObjectProperty {
  key: string;
  schema: SchemaNode;
  optional?: boolean;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function hasObjects(schema: SchemaNode): boolean {
  if (schema.kind === "object") {
    return true;
  }
  if (schema.kind === "array") {
    return hasObjects(schema.items);
  }
  return false;
}

export function hasNestedObjects(schema: SchemaNode): boolean {
  if (schema.kind === "object") {
    for (const prop of schema.properties) {
      if (hasObjects(prop.schema)) {
        return true;
      }
    }
    return false;
  }
  if (schema.kind === "array") {
    return hasObjects(schema.items);
  }
  return false;
}

export function inferSchema(value: JsonValue): SchemaNode {
  if (value === null) {
    return { kind: "null" };
  }

  switch (typeof value) {
    case "string":
      return { kind: "string" };
    case "number":
      return { kind: "number" };
    case "boolean":
      return { kind: "boolean" };
    case "object":
      if (Array.isArray(value)) {
        return inferArray(value);
      }

      return {
        kind: "object",
        properties: Object.entries(value).map(([key, propertyValue]) => ({
          key,
          schema: inferSchema(propertyValue),
        })),
      };
    default:
      throw new Error(`Unsupported JSON value: ${String(value)}`);
  }
}

function inferArray(items: JsonValue[]): SchemaNode {
  if (items.length === 0) {
    return { kind: "array", items: { kind: "unknown" } };
  }

  const schemas = items.map((item) => inferSchema(item));
  const hasNull = schemas.some((s) => s.kind === "null");
  const nonNullSchemas = schemas.filter((s) => s.kind !== "null");
  const nonNullItems = items.filter((item) => item !== null);

  if (nonNullSchemas.length === 0) {
    return { kind: "array", items: { kind: "null" } };
  }

  const allObjects = nonNullSchemas.every((s) => s.kind === "object");
  if (allObjects) {
    const merged = mergeObjectArray(nonNullItems);
    return {
      kind: "array",
      items: hasNull ? { ...merged, nullable: true } : merged,
    };
  }

  const firstKind = nonNullSchemas[0]?.kind;
  const allSameKind = nonNullSchemas.every((s) => s.kind === firstKind);
  if (allSameKind) {
    if (firstKind === "array") {
      const nestedItems: JsonValue[] = [];
      for (const item of nonNullItems) {
        nestedItems.push(...(item as JsonValue[]));
      }
      const inner = inferArray(nestedItems);
      return {
        kind: "array",
        items: hasNull ? { ...inner, nullable: true } : inner,
      };
    }
    const baseSchema = nonNullSchemas[0];
    if (!baseSchema) {
      throw new Error("unreachable: nonNullSchemas is non-empty");
    }
    return {
      kind: "array",
      items: hasNull ? { ...baseSchema, nullable: true } : baseSchema,
    };
  }

  return { kind: "array", items: { kind: "unknown" } };
}

function mergeObjectArray(items: JsonValue[]): SchemaNode {
  const schemas = items.map((item) => inferSchema(item));

  for (const s of schemas) {
    if (s.kind !== "object") {
      throw new Error("Expected all array items to be objects");
    }
  }

  const objects = schemas as Extract<SchemaNode, { kind: "object" }>[];

  const keyOrder: string[] = [];
  for (const obj of objects) {
    for (const prop of obj.properties) {
      if (!keyOrder.includes(prop.key)) {
        keyOrder.push(prop.key);
      }
    }
  }

  const properties: ObjectProperty[] = [];
  for (const key of keyOrder) {
    const schemasForKey: SchemaNode[] = [];
    for (const obj of objects) {
      const prop = obj.properties.find((p) => p.key === key);
      if (prop) {
        schemasForKey.push(prop.schema);
      }
    }

    const optional = schemasForKey.length < objects.length;

    let mergedSchema: SchemaNode;
    if (schemasForKey.length === 0) {
      mergedSchema = { kind: "unknown" };
    } else {
      const [first, ...rest] = schemasForKey;
      mergedSchema = first;
      for (const s of rest) {
        mergedSchema = mergeSchemas(mergedSchema, s);
      }
    }

    const prop: ObjectProperty = { key, schema: mergedSchema };
    if (optional) {
      prop.optional = true;
    }
    properties.push(prop);
  }

  return { kind: "object", properties };
}

function mergeSchemas(a: SchemaNode, b: SchemaNode): SchemaNode {
  if (a.kind === "unknown" || b.kind === "unknown") {
    return { kind: "unknown" };
  }

  if (a.kind === "null" && b.kind === "null") {
    return { kind: "null" };
  }
  if (a.kind === "null") {
    return { ...b, nullable: true } as SchemaNode;
  }
  if (b.kind === "null") {
    return { ...a, nullable: true } as SchemaNode;
  }

  if (a.kind !== b.kind) {
    return { kind: "unknown" };
  }

  const nullable = a.nullable || b.nullable;

  if (a.kind === "object" && b.kind === "object") {
    const aMap = new Map(a.properties.map((p) => [p.key, p]));
    const bMap = new Map(b.properties.map((p) => [p.key, p]));

    const orderedKeys = [
      ...a.properties.map((p) => p.key),
      ...b.properties.filter((p) => !aMap.has(p.key)).map((p) => p.key),
    ];

    const properties: ObjectProperty[] = [];
    for (const key of orderedKeys) {
      const aProp = aMap.get(key);
      const bProp = bMap.get(key);

      if (aProp && bProp) {
        const optional = aProp.optional || bProp.optional;
        const prop: ObjectProperty = {
          key,
          schema: mergeSchemas(aProp.schema, bProp.schema),
        };
        if (optional) {
          prop.optional = true;
        }
        properties.push(prop);
      } else if (aProp) {
        properties.push({ key, schema: aProp.schema, optional: true });
      } else if (bProp) {
        properties.push({ key, schema: bProp.schema, optional: true });
      } else {
        throw new Error("unreachable: key must exist in either a or b");
      }
    }

    const result: SchemaNode = { kind: "object", properties };
    if (nullable) {
      result.nullable = true;
    }
    return result;
  }

  if (a.kind === "array" && b.kind === "array") {
    const items = mergeSchemas(a.items, b.items);
    const result: SchemaNode = { kind: "array", items };
    if (nullable) {
      result.nullable = true;
    }
    return result;
  }

  const result: SchemaNode = {
    kind: a.kind as "string" | "number" | "boolean",
  };
  if (nullable) {
    result.nullable = true;
  }
  return result;
}
