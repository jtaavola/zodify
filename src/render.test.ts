import { describe, expect, it } from "vitest";
import { inferSchema } from "./infer.js";
import { renderModule, renderSchema } from "./render.js";

describe("renderSchema", () => {
  it("renders primitive JSON schemas", () => {
    expect(renderSchema({ kind: "string" })).toBe("z.string()");
    expect(renderSchema({ kind: "number" })).toBe("z.number()");
    expect(renderSchema({ kind: "boolean" })).toBe("z.boolean()");
    expect(renderSchema({ kind: "null" })).toBe("z.null()");
  });

  it("renders strict objects preserving property order", () => {
    const schema = inferSchema({ id: "123", active: true, count: 2 });

    expect(renderSchema(schema)).toBe(`z.strictObject({
  id: z.string(),
  active: z.boolean(),
  count: z.number(),
})`);
  });

  it("quotes invalid property names only", () => {
    const schema = {
      kind: "object" as const,
      properties: [
        { key: "first-name", schema: { kind: "string" as const } },
        { key: "123", schema: { kind: "boolean" as const } },
        { key: "default", schema: { kind: "string" as const } },
        { key: "normal", schema: { kind: "number" as const } },
      ],
    };

    expect(renderSchema(schema)).toBe(`z.strictObject({
  "first-name": z.string(),
  "123": z.boolean(),
  default: z.string(),
  normal: z.number(),
})`);
  });

  it("renders a complete TypeScript module", () => {
    const schema = inferSchema({ id: "123", active: true, "first-name": "Ada" });

    expect(renderModule(schema)).toBe(`import { z } from "zod";

export const schema = z.strictObject({
  id: z.string(),
  active: z.boolean(),
  "first-name": z.string(),
});
`);
  });
});
