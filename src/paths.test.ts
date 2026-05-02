import { describe, expect, it } from "vitest";
import { collectOptionalPaths, applyOptionalPaths } from "./paths.js";
import { inferSchema } from "./infer.js";

describe("collectOptionalPaths", () => {
  it("returns empty for primitives", () => {
    expect(collectOptionalPaths({ kind: "string" })).toEqual([]);
  });

  it("collects root object property paths", () => {
    const schema = inferSchema({ id: "1", name: "Ada" });
    expect(collectOptionalPaths(schema)).toEqual([
      { path: "id", optional: false },
      { path: "name", optional: false },
    ]);
  });

  it("collects nested object property paths", () => {
    const schema = inferSchema({ user: { profile: { name: "Ada" } } });
    expect(collectOptionalPaths(schema)).toEqual([
      { path: "user", optional: false },
      { path: "user.profile", optional: false },
      { path: "user.profile.name", optional: false },
    ]);
  });

  it("collects array item object property paths", () => {
    const schema = inferSchema({
      posts: [{ title: "Hello", tags: ["a"] }],
    });
    expect(collectOptionalPaths(schema)).toEqual([
      { path: "posts", optional: false },
      { path: "posts[].title", optional: false },
      { path: "posts[].tags", optional: false },
    ]);
  });

  it("does not include array paths themselves", () => {
    const schema = inferSchema([{ id: "1" }]);
    expect(collectOptionalPaths(schema)).toEqual([
      { path: "[].id", optional: false },
    ]);
  });

  it("preselects inferred optional fields from merged arrays", () => {
    const schema = inferSchema([
      { id: "1", name: "Ada" },
      { id: "2" },
    ]);
    expect(collectOptionalPaths(schema)).toEqual([
      { path: "[].id", optional: false },
      { path: "[].name", optional: true },
    ]);
  });

  it("handles deeply nested arrays of objects", () => {
    const schema = inferSchema({
      users: [{ posts: [{ title: "Hello" }] }],
    });
    expect(collectOptionalPaths(schema)).toEqual([
      { path: "users", optional: false },
      { path: "users[].posts", optional: false },
      { path: "users[].posts[].title", optional: false },
    ]);
  });
});

describe("applyOptionalPaths", () => {
  it("marks only selected paths as optional", () => {
    const schema = inferSchema({ id: "1", name: "Ada" });
    const result = applyOptionalPaths(schema, new Set(["name"]));
    expect(result).toEqual({
      kind: "object",
      properties: [
        { key: "id", schema: { kind: "string" } },
        { key: "name", schema: { kind: "string" }, optional: true },
      ],
    });
  });

  it("removes inferred optional when not selected", () => {
    const schema = inferSchema([
      { id: "1", name: "Ada" },
      { id: "2" },
    ]);
    const result = applyOptionalPaths(schema, new Set(["[].id"]));
    expect(result).toEqual({
      kind: "array",
      items: {
        kind: "object",
        properties: [
          { key: "id", schema: { kind: "string" }, optional: true },
          { key: "name", schema: { kind: "string" } },
        ],
      },
    });
  });

  it("preserves nullable when applying optional", () => {
    const schema = inferSchema([
      { name: "Ada" },
      { name: null },
      {},
    ]);
    const result = applyOptionalPaths(schema, new Set(["[].name"]));
    expect(result).toEqual({
      kind: "array",
      items: {
        kind: "object",
        properties: [
          { key: "name", schema: { kind: "string", nullable: true }, optional: true },
        ],
      },
    });
  });

  it("handles nested paths", () => {
    const schema = inferSchema({ user: { profile: { name: "Ada", age: 30 } } });
    const result = applyOptionalPaths(schema, new Set(["user.profile.name"]));
    expect(result).toEqual({
      kind: "object",
      properties: [
        {
          key: "user",
          schema: {
            kind: "object",
            properties: [
              {
                key: "profile",
                schema: {
                  kind: "object",
                  properties: [
                    { key: "name", schema: { kind: "string" }, optional: true },
                    { key: "age", schema: { kind: "number" } },
                  ],
                },
              },
            ],
          },
        },
      ],
    });
  });

  it("handles array item object paths", () => {
    const schema = inferSchema({
      posts: [{ title: "Hello", body: "World" }],
    });
    const result = applyOptionalPaths(schema, new Set(["posts[].title"]));
    expect(result).toEqual({
      kind: "object",
      properties: [
        {
          key: "posts",
          schema: {
            kind: "array",
            items: {
              kind: "object",
              properties: [
                { key: "title", schema: { kind: "string" }, optional: true },
                { key: "body", schema: { kind: "string" } },
              ],
            },
          },
        },
      ],
    });
  });
});
