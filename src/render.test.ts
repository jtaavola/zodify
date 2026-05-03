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

  it("renders loose objects preserving property order", () => {
    const schema = inferSchema({ id: "123", active: true, count: 2 });

    expect(renderSchema(schema, 0, "loose")).toBe(`z.looseObject({
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

  it("renders a complete TypeScript module in loose mode", () => {
    const schema = inferSchema({ id: "123", active: true, "first-name": "Ada" });

    expect(renderModule(schema, "loose")).toBe(`import { z } from "zod";

export const schema = z.looseObject({
  id: z.string(),
  active: z.boolean(),
  "first-name": z.string(),
});
`);
  });

  it("renders unknown schema", () => {
    expect(renderSchema({ kind: "unknown" })).toBe("z.unknown()");
  });

  it("renders empty arrays", () => {
    expect(renderSchema({ kind: "array", items: { kind: "unknown" } })).toBe(
      "z.array(z.unknown())"
    );
  });

  it("renders primitive arrays", () => {
    expect(renderSchema({ kind: "array", items: { kind: "string" } })).toBe(
      "z.array(z.string())"
    );
    expect(renderSchema({ kind: "array", items: { kind: "number" } })).toBe(
      "z.array(z.number())"
    );
  });

  it("renders arrays of objects with optional fields", () => {
    const schema = inferSchema([
      { id: "1", name: "Ada" },
      { id: "2", email: "ada@example.com" },
    ]);

    expect(renderSchema(schema)).toBe(`z.array(
  z.strictObject({
    id: z.string(),
    name: z.string().optional(),
    email: z.string().optional(),
  })
)`);
  });

  it("renders arrays of objects in loose mode", () => {
    const schema = inferSchema([
      { id: "1", name: "Ada" },
      { id: "2", email: "ada@example.com" },
    ]);

    expect(renderSchema(schema, 0, "loose")).toBe(`z.array(
  z.looseObject({
    id: z.string(),
    name: z.string().optional(),
    email: z.string().optional(),
  })
)`);
  });

  it("renders arrays with conflicting field types", () => {
    const schema = inferSchema([
      { id: "1", age: 42 },
      { id: "2", age: "unknown" },
    ]);

    expect(renderSchema(schema)).toBe(`z.array(
  z.strictObject({
    id: z.string(),
    age: z.unknown(),
  })
)`);
  });

  it("renders mixed arrays", () => {
    expect(renderSchema({ kind: "array", items: { kind: "unknown" } })).toBe(
      "z.array(z.unknown())"
    );
  });

  it("renders a complete module with arrays", () => {
    const schema = inferSchema({
      users: [
        { id: "1", name: "Ada" },
        { id: "2", email: "ada@example.com" },
      ],
    });

    expect(renderModule(schema)).toBe(`import { z } from "zod";

export const schema = z.strictObject({
  users: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string().optional(),
      email: z.string().optional(),
    })
  ),
});
`);
  });

  it("renders a complete module with arrays in loose mode", () => {
    const schema = inferSchema({
      users: [
        { id: "1", name: "Ada" },
        { id: "2", email: "ada@example.com" },
      ],
    });

    expect(renderModule(schema, "loose")).toBe(`import { z } from "zod";

export const schema = z.looseObject({
  users: z.array(
    z.looseObject({
      id: z.string(),
      name: z.string().optional(),
      email: z.string().optional(),
    })
  ),
});
`);
  });

  it("renders nullable schemas", () => {
    expect(renderSchema({ kind: "string", nullable: true })).toBe("z.string().nullable()");
    expect(renderSchema({ kind: "number", nullable: true })).toBe("z.number().nullable()");
    expect(renderSchema({ kind: "boolean", nullable: true })).toBe("z.boolean().nullable()");
  });

  it("renders nullable and optional object properties", () => {
    const schema = inferSchema([
      { name: "Ada" },
      { name: null },
      {},
    ]);

    expect(renderSchema(schema)).toBe(`z.array(
  z.strictObject({
    name: z.string().nullable().optional(),
  })
)`);
  });

  it("renders arrays with nullable items", () => {
    expect(renderSchema({ kind: "array", items: { kind: "string", nullable: true } })).toBe(
      "z.array(z.string().nullable())"
    );
  });

  it("renders a complete module with nullable fields", () => {
    const schema = inferSchema({
      users: [
        { name: "Ada" },
        { name: null },
        {},
      ],
    });

    expect(renderModule(schema)).toBe(`import { z } from "zod";

export const schema = z.strictObject({
  users: z.array(
    z.strictObject({
      name: z.string().nullable().optional(),
    })
  ),
});
`);
  });

  it("renders empty objects as z.strictObject({}) in strict mode", () => {
    expect(renderSchema({ kind: "object", properties: [] })).toBe(
      "z.strictObject({})"
    );
  });

  it("renders empty objects as z.looseObject({}) in loose mode", () => {
    expect(renderSchema({ kind: "object", properties: [] }, 0, "loose")).toBe(
      "z.looseObject({})"
    );
  });

  it("returns a reference name for nested objects in separate mode", () => {
    const nested = inferSchema({ id: "1" });
    const schema = inferSchema({ user: { id: "1" } });

    const rendered = renderSchema(schema, 0, "strict", "separate", "", new Map(), new Map(), new Set());
    expect(rendered).toBe(`z.strictObject({\n  user: userSchema,\n})`);
  });

  it("renders deeply nested objects in nested mode", () => {
    const schema = inferSchema({
      user: {
        profile: {
          name: "Ada",
        },
      },
    });

    expect(renderSchema(schema)).toBe(`z.strictObject({
  user: z.strictObject({
    profile: z.strictObject({
      name: z.string(),
    }),
  }),
})`);
  });

  it("renders arrays of arrays", () => {
    expect(
      renderSchema({ kind: "array", items: { kind: "array", items: { kind: "string" } } })
    ).toBe("z.array(z.array(z.string()))");
  });
});

describe("renderModule top-level primitives", () => {
  it("renders a complete module with a top-level string", () => {
    expect(renderModule({ kind: "string" })).toBe(
      `import { z } from "zod";\n\nexport const schema = z.string();\n`
    );
  });

  it("renders a complete module with a top-level number", () => {
    expect(renderModule({ kind: "number" })).toBe(
      `import { z } from "zod";\n\nexport const schema = z.number();\n`
    );
  });

  it("renders a complete module with a top-level boolean", () => {
    expect(renderModule({ kind: "boolean" })).toBe(
      `import { z } from "zod";\n\nexport const schema = z.boolean();\n`
    );
  });

  it("renders a complete module with a top-level null", () => {
    expect(renderModule({ kind: "null" })).toBe(
      `import { z } from "zod";\n\nexport const schema = z.null();\n`
    );
  });

  it("renders a complete module with a top-level unknown", () => {
    expect(renderModule({ kind: "unknown" })).toBe(
      `import { z } from "zod";\n\nexport const schema = z.unknown();\n`
    );
  });

  it("renders a complete module with a top-level array", () => {
    expect(renderModule({ kind: "array", items: { kind: "number" } })).toBe(
      `import { z } from "zod";\n\nexport const schema = z.array(z.number());\n`
    );
  });

  it("renders a complete module with arrays of arrays", () => {
    expect(
      renderModule({ kind: "array", items: { kind: "array", items: { kind: "string" } } })
    ).toBe(`import { z } from "zod";\n\nexport const schema = z.array(z.array(z.string()));\n`);
  });
});

describe("renderModule separate mode", () => {
  it("renders nested objects as separate exports", () => {
    const schema = inferSchema({ user: { id: "1", name: "Ada" } });

    expect(renderModule(schema, "strict", "separate")).toBe(`import { z } from "zod";

export const userSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
});

export const schema = z.strictObject({
  user: userSchema,
});
`);
  });

  it("renders deeply nested objects as separate exports", () => {
    const schema = inferSchema({
      user: {
        profile: {
          name: "Ada",
        },
      },
    });

    expect(renderModule(schema, "strict", "separate")).toBe(`import { z } from "zod";

export const userProfileSchema = z.strictObject({
  name: z.string(),
});

export const userSchema = z.strictObject({
  profile: userProfileSchema,
});

export const schema = z.strictObject({
  user: userSchema,
});
`);
  });

  it("renders array item objects as separate exports", () => {
    const schema = inferSchema({
      users: [{ id: "1" }, { id: "2" }],
    });

    expect(renderModule(schema, "strict", "separate")).toBe(`import { z } from "zod";

export const usersItemSchema = z.strictObject({
  id: z.string(),
});

export const schema = z.strictObject({
  users: z.array(usersItemSchema),
});
`);
  });

  it("renders top-level arrays with separate item exports", () => {
    const schema = inferSchema([{ id: "1" }]);

    expect(renderModule(schema, "strict", "separate")).toBe(`import { z } from "zod";

export const itemSchema = z.strictObject({
  id: z.string(),
});

export const schema = z.array(itemSchema);
`);
  });

  it("uses numbered suffixes for duplicate names", () => {
    const schema = inferSchema({
      user: { id: "1" },
      User: { id: "2" },
    });

    expect(renderModule(schema, "strict", "separate")).toBe(`import { z } from "zod";

export const userSchema = z.strictObject({
  id: z.string(),
});

export const userSchema2 = z.strictObject({
  id: z.string(),
});

export const schema = z.strictObject({
  user: userSchema,
  User: userSchema2,
});
`);
  });

  it("renders separate mode in loose mode", () => {
    const schema = inferSchema({ user: { id: "1" } });

    expect(renderModule(schema, "loose", "separate")).toBe(`import { z } from "zod";

export const userSchema = z.looseObject({
  id: z.string(),
});

export const schema = z.looseObject({
  user: userSchema,
});
`);
  });

  it("renders a complete module with arrays in separate mode", () => {
    const schema = inferSchema({
      users: [
        { id: "1", name: "Ada" },
        { id: "2", email: "ada@example.com" },
      ],
    });

    expect(renderModule(schema, "strict", "separate")).toBe(`import { z } from "zod";

export const usersItemSchema = z.strictObject({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
});

export const schema = z.strictObject({
  users: z.array(usersItemSchema),
});
`);
  });

  it("preserves nullable on nested objects in separate mode", () => {
    const schema = inferSchema([
      { user: { id: "1" } },
      { user: null },
    ]);

    expect(renderModule(schema, "strict", "separate")).toBe(`import { z } from "zod";

export const itemUserSchema = z.strictObject({
  id: z.string(),
});

export const itemSchema = z.strictObject({
  user: itemUserSchema.nullable(),
});

export const schema = z.array(itemSchema);
`);
  });
});
