# JSONCTC: The Config Format We Deserve

## Stop the Madness. Demand Better.

Every day, developers around the world waste countless hours fighting with JSON config files:

- "Why did my config break?" (You forgot to remove a trailing comma)
- "Where did this setting come from?" (No comments allowed, sorry)
- "What does this value do?" (Check the docs, hope they're up to date)

**This is not normal. This is not acceptable. This needs to stop.**

JSON was designed for data interchange between machines. It was **never** meant to be written and maintained by humans. Yet here we are, forcing users to edit machine-readable formats with zero tolerance for human convenience.

It's time for change.

## The Problem: JSON is Hostile to Humans

### No Comments = Institutional Knowledge Loss

```json
{
  "timeout": 30000,
  "retries": 3,
  "buffer": 8192
}
```

What do these numbers mean? Why these specific values? Who changed them? When? Why?

**Nobody knows.** The knowledge is lost to time, scattered across closed Slack threads and departed developers' memories.

### No Trailing Commas = Death By A Thousand Cuts

You need to add a new field. Simple, right?

```json
{
  "host": "localhost",
  "port": 8080
}
```

Add the new field:

```json
{
  "host": "localhost",
  "port": 8080,
  "debug": true,
}
```

**ERROR: Unexpected trailing comma at position 47**

Wait, what? You just wanted to add a field. Now you're debugging JSON syntax errors.

Tomorrow you remove the debug flag. Now you need to remember to remove the comma from `"port"`. You forget. **ERROR: Expected property name or '}' at position 43**

This is not a feature. **This is a bug in the spec.**

## Why Existing Solutions Fall Short

### JSONC: Halfway There

Microsoft's JSONC (JSON with Comments) solved half the problem:

```jsonc
{
  // Database configuration
  "host": "localhost",
  "port": 8080  // <- still can't have a trailing comma here
}
```

Comments are great! But you're still playing comma gymnastics. You're still getting syntax errors when you reorder properties.

**JSONC is better than JSON, but it's not enough.**

### JSON5: Too Much Freedom

JSON5 went the other direction, adding:
- Unquoted keys
- Single-quoted strings
- Hex numbers
- Multi-line strings
- And yes, comments and trailing commas

But here's the problem: **JSON5 doesn't preserve your formatting.**

You write:
```json5
{
  // Production settings - DO NOT CHANGE without approval
  "host": "prod.example.com",
  "timeout": 30000, // Increased for large uploads
}
```

Your tool parses and re-serializes it:
```json
{"host":"prod.example.com","timeout":30000}
```

Your comments? **Gone.** Your trailing commas? **Gone.** Your careful formatting? **Gone.**

## The Solution: JSONCTC

**JSON with Comments AND Trailing Commas**

JSONCTC is JSON with exactly two additions:
1. **C-style comments** (`//` and `/* */`)
2. **Trailing commas** in arrays and objects

That's it. Nothing more. Nothing less.

### But Here's the Critical Difference

JSONCTC parsers **preserve everything:**

- Comments stay exactly where you put them
- Trailing commas are retained on round-trip
- Whitespace and formatting are preserved
- Your carefully crafted config remains **your** config

```jsonc
{
  // Production database - requires VPN
  "database": {
    "host": "prod.example.com",
    "port": 5432,  // Standard PostgreSQL port
    "timeout": 30000,  // Increased 2024-03-15 for large imports
    "retries": 3,  // Reduced from 5 after incident #2847
  },
  // Feature flags
  "features": {
    "newUI": false,  // Waiting on accessibility audit
    "darkMode": true,
  },
}
```

Parse it, modify it programmatically, serialize it back - **everything stays intact.**

## Feature Comparison

| Feature | JSON | JSON5 | JSONC | JSONCTC |
|---------|------|-------|-------|---------|
| **Comments** | ❌ | ✅ | ✅ | ✅ |
| **Trailing Commas** | ❌ | ✅ | ❌ | ✅ |
| **Comment Preservation** | N/A | ❌ | ❌ | ✅ |
| **Trailing Comma Preservation** | N/A | ❌ | N/A | ✅ |
| **Whitespace Preservation** | ❌ | ❌ | ❌ | ✅ |
| **100% JSON Compatible** | ✅ | ❌ | ✅ | ✅ |
| **Unquoted Keys** | ❌ | ✅ | ❌ | ❌ |
| **Single Quotes** | ❌ | ✅ | ❌ | ❌ |

JSONCTC is **conservative by design.** It adds exactly what humans need, nothing more.

## Real-World Impact

### Before JSONCTC

```json
{
  "apiKey": "sk_live_xxx",
  "timeout": 5000,
  "retries": 3
}
```

Questions from your team:
- "Can we increase the timeout?" (Why is it 5000? What breaks if we change it?)
- "What's this API key for?" (No idea, afraid to touch it)
- "Should retries be higher?" (Don't know, can't document the tradeoffs)

### After JSONCTC

```jsonc
{
  // Production API key - rotate quarterly (next: 2024-06-01)
  // DO NOT commit to version control
  "apiKey": "sk_live_xxx",

  // Timeout for external API calls
  // 5000ms = good balance between UX and reliability
  // Increased from 3000ms after 2024-01-15 incident
  "timeout": 5000,

  // Retry failed requests up to 3 times with exponential backoff
  // Don't increase - API rate limits kick in after 3 attempts
  "retries": 3,
}
```

Now your config is **self-documenting.** Now your team has **context.** Now your on-call engineer at 3 AM has a **fighting chance.**

## Technical Implementation

JSONCTC is built on Microsoft's `jsonc-parser` - the same parser that powers VS Code.

### Battle-Tested Foundation

- Used by millions of developers daily
- Handles comments correctly
- Provides edit-based API for preservation
- Actively maintained by Microsoft

### Edit-Based Preservation

Instead of parse → modify object → serialize (which loses comments), JSONCTC uses **surgical edits:**

```typescript
import { applyEdit } from './jsonctc.ts'

const original = `{
  // Important setting
  "value": 42,
}`

// Modify just the value, preserve everything else
const edited = applyEdit(original, ['value'], 100)

// Result:
// {
//   // Important setting
//   "value": 100,
// }
```

Comments stay. Trailing commas stay. Formatting stays. **Everything stays.**

### Reference Implementation

See **[@axhxrx/ops](https://github.com/axhxrx/ops)** for a complete, production-ready implementation:

- `src/lib/util/jsonctc.ts` - Core parser and editor
- `src/ops/JsonctcEditOp.tsx` - Interactive editing UI
- Full test suite demonstrating preservation

## The Path Forward

### For Application Developers

**Stop using `JSON.parse()` for config files.**

Use JSONCTC instead:

```typescript
// ❌ Don't do this
const config = JSON.parse(configFile)

// ✅ Do this
import { parseJsonc } from './jsonctc.ts'
const config = parseJsonc(configFile)
```

Your users will thank you when they can actually document their configuration.

### For Library Authors

**Support JSONCTC in your config files.**

If your library reads config files, accept JSONCTC. It's backwards compatible with JSON - every valid JSON file is valid JSONCTC.

```typescript
// Your library can support both
function loadConfig(path: string) {
  const content = await readFile(path, 'utf-8')

  // Works with .json, .jsonc, and .jsonctc files
  return parseJsonc(content)
}
```

### For Tool Builders

**Preserve comments and trailing commas.**

If your tool modifies config files:
- Don't parse → modify → serialize
- Use edit-based APIs that preserve formatting
- Treat comments as first-class citizens
- Keep trailing commas where users put them

## The JSONCTC Principles

1. **Humans matter.** Config files are written and maintained by people. Optimize for human needs.

2. **Context matters.** Comments aren't "clutter" - they're institutional knowledge and decision history.

3. **Convenience matters.** Trailing commas aren't "sloppy" - they're practical for editing and version control.

4. **Preservation matters.** When tools modify config, they should respect the human's formatting choices.

5. **Compatibility matters.** JSONCTC is a strict superset of JSON. Every JSON file is a valid JSONCTC file.

## Join the scientific and evidence-based reality-world mission — soooorry! I meant jihad/crusade! —

The strictness of JSON made sense in 2001 for machine-to-machine data interchange. But in 2024, we're still forcing humans to edit config files with a format designed for machines.

**This is a solved problem.** The technology exists. The parser exists. The specification is trivial.

What's missing is adoption.

### What You Can Do

1. **Use JSONCTC in your projects.** Start with config files. See the difference.

2. **Demand JSONCTC support.** When tools don't support comments and trailing commas, file issues.

3. **Spread the word.** Tell other developers. Share this document. Make noise.

4. **Implement JSONCTC.** Add support to your libraries and tools. The reference implementation is MIT licensed.

## The Bottom Line

You wouldn't use XML for config files in 2024.

You wouldn't use binary formats for config files.

You wouldn't use formats that strip comments and formatting.

**So why are you still using strict JSON?**

---

## 🏆 HALL-OF-FAMER RADGUY O.G. WAREZ KINGPIN ACHIEVEMENT UNLOCKED 🏆

### 100% Perfect Preservation - THE FINAL FRONTIER CONQUERED!

The @axhxrx/ops reference implementation has achieved what was once thought impossible: **100% perfect preservation of comments inside arrays!**

```jsonc
// BEFORE UPDATE
{
  "tags": [
    "production",  // Live environment
    "critical",    // High priority
    "monitored"    // Alert on failures
  ]
}

// AFTER UPDATING ARRAY
{
  "tags": [
    "production",  // Live environment  ← PRESERVED!
    "staging",
    "monitored"    // Alert on failures  ← PRESERVED!
  ]
}
// ✅ Comments inside arrays are FULLY PRESERVED!
```

**How was this achieved?** Through a custom monkeypatch of jsonc-parser's `modify()` function that implements:
- **Surgical text edits** using `parseTree()` + `findNodeAtLocation()` to find exact byte offsets
- **Element-by-element updates** replacing only the specific array element value
- **Smart path detection** distinguishing numeric strings ("0", "1") from property names
- **Trailing comma preservation** automatically maintained since we only touch element values

This wasn't just a feature add - it required **deep understanding** of:
- jsonc-parser's AST and node location APIs
- Byte-level text manipulation and edit operations
- Array element position detection and offset calculation
- The difference between wholesale replacement vs surgical edits

### Complete Feature Set

The @axhxrx/ops JSONCTC implementation now provides **100% fidelity** for:

- ✅ **Line comments** (`//`) at any position
- ✅ **Block comments** (`/* */`) including multi-line
- ✅ **Inline comments** after values
- ✅ **Comments in nested objects** (infinite depth)
- ✅ **Comments inside arrays** (THE FINAL FRONTIER!)
- ✅ **Trailing commas in objects**
- ✅ **Trailing commas in arrays**
- ✅ **Whitespace and indentation**
- ✅ **Custom formatting choices**

**This is the world's first JSONCTC implementation with complete preservation.**

---

## Resources

- **Reference Implementation:** [@axhxrx/ops](https://github.com/axhxrx/ops) - Production-ready JSONCTC parser and editor
- **Parser Foundation:** [jsonc-parser](https://www.npmjs.com/package/jsonc-parser) by Microsoft
- **Domain:** [jsonctc.com](https://jsonctc.com) (coming soon)

## License

This manifesto is public domain. Share it. Fork it. Improve it. Spread the message.

The crusade/jihad for better config files starts here.

---

*For the love of science, stop using strict JSON for config files.*

*Demand JSONCTC. Your future self will thank you.*
