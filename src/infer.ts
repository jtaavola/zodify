export type SchemaNode =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "null" }
  | { kind: "unknown" }
  | { kind: "array"; items: SchemaNode }
  | { kind: "object"; properties: ObjectProperty[] };

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

  const allObjects = schemas.every((s) => s.kind === "object");
  if (allObjects) {
    return { kind: "array", items: mergeObjectArray(items) };
  }

  const firstKind = schemas[0]!.kind;
  const allSameKind = schemas.every((s) => s.kind === firstKind);
  if (allSameKind) {
    if (firstKind === "array") {
      const nestedItems: JsonValue[] = [];
      for (const item of items) {
        nestedItems.push(...(item as JsonValue[]));
      }
      return { kind: "array", items: inferArray(nestedItems) };
    }
    return { kind: "array", items: schemas[0]! };
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
      mergedSchema = schemasForKey[0]!;
      for (let i = 1; i < schemasForKey.length; i++) {
        mergedSchema = mergeSchemas(mergedSchema, schemasForKey[i]!);
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
  if (a.kind !== b.kind) {
    return { kind: "unknown" };
  }

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
        const prop: ObjectProperty = { key, schema: mergeSchemas(aProp.schema, bProp.schema) };
        if (optional) {
          prop.optional = true;
        }
        properties.push(prop);
      } else if (aProp) {
        properties.push({ key, schema: aProp.schema, optional: true });
      } else {
        properties.push({ key, schema: bProp!.schema, optional: true });
      }
    }

    return { kind: "object", properties };
  }

  if (a.kind === "array" && b.kind === "array") {
    return { kind: "array", items: mergeSchemas(a.items, b.items) };
  }

  return a;
}
