# zodify-json

Convert sample JSON responses into [Zod](https://zod.dev) schemas.

## Install

```bash
npm i -g zodify-json
```

Or run without installing:

```bash
npx zodify-json < input.json
```

## Usage

```bash
# From a file
zodify response.json

# From stdin
cat response.json | zodify

# Non-interactive with all flags
zodify -n --object-mode=strict -m separate -a response.json -o schema.ts
```

## Options

| Flag | Description |
|------|-------------|
| `-n, --non-interactive` | Skip all interactive prompts (requires config flags) |
| `--object-mode=<strict\|loose>` | `strict` rejects unknown keys; `loose` allows them |
| `-m, --nested-mode=<nested\|separate>` | `nested` inlines objects; `separate` exports each as a named schema |
| `-p, --optional <path,path,...>` | Comma-separated dotted paths to mark as optional |
| `-a, --optional-all` | Mark every field as optional |
| `-o, --output <file>` | Write output to a file instead of stdout |
| `-h, --help` | Show help |

## Interactive Mode

When run without `--non-interactive`, zodify guides you through:

1. **Object mode** — strict vs loose validation
2. **Nested schemas** — inline definitions or separate named exports
3. **Optional fields** — checkbox list of every field in the JSON

## Examples

### Basic JSON

```bash
$ echo '{"name": "Ada", "age": 36}' | zodify
```

```typescript
import { z } from "zod";

export const schema = z.strictObject({
  name: z.string(),
  age: z.number(),
});
```

### Arrays with merged objects

```bash
$ echo '[{"a": 1}, {"a": 2, "b": 3}]' | zodify -n --object-mode=loose -a
```

```typescript
import { z } from "zod";

export const schema = z.array(
  z.looseObject({
    a: z.number().optional(),
    b: z.number().optional(),
  })
);
```

### Separate nested schemas

```bash
$ cat user.json | zodify -n --object-mode=strict -m separate -a
```

```typescript
import { z } from "zod";

export const addressSchema = z.strictObject({
  city: z.string().optional(),
  zip: z.string().optional(),
});

export const schema = z.strictObject({
  name: z.string().optional(),
  address: addressSchema.optional(),
});
```

## How it works

- Infers types from JSON primitives (`string`, `number`, `boolean`, `null`)
- Merges object shapes across array items so missing keys become optional
- Handles nullable values (`null` mixed with other types)
- Empty arrays fall back to `z.unknown()`
- Mixed-type arrays fall back to `z.unknown()`

## Development

```bash
npm install
npm run build
npm test
```

