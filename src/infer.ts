export type SchemaNode =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "null" }
  | { kind: "object"; properties: ObjectProperty[] };

export interface ObjectProperty {
  key: string;
  schema: SchemaNode;
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
        throw new Error("Array inference is not supported in this phase.");
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
