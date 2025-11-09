# ops

🚨 WARNING: AI SLOP AHEAD 🚨

This is mostly an experiment in patterns to help elicit more useful outputs from coding LLMs.

Therefore, while the code has been reviewed for actually-dangerous bugs or harmful intent, it has generally not been _improved_, but left as-is. Some of the ops therefore contain many bugs, and may malfunction in various ways.

You probably do not want to use this, therefore, unless perhaps you are also experimenting with trying to get more useful outputs from coding automatons.

## What is This?

The Ops Pattern is a simplification pattern that provides a constrained, fewer-choices-to-make way to structure CLI applications. Every action — from basic user interactions like confirmation prompts abd (😅 you can tell a human wrote _this_ part, right, but not a lot of what follows...) menus, to making network requests, to executing subcommands or processsing files, or whatever business logic, is implemented as an **Op** that returns a standardized `Outcome`.

Ops compose naturally, are independently testable, often also independently runnable as command-line tools, and provide a framework for implementing observability, monitoring, and logging.

But the main point of them is that they force as much of the software as possible into the same basic pattern, which is not super-annoying for a human (maybe a little bit, though) and seems to provide the simplicity and testability to make it easier for LLMs to... whatever it is they do that seems like _reasoning_, about the code. It's a pattern that has yielded better useful results, and fewer useless or harmful results, from 2025-era coding LLMs like GPT5-Codex and Claude Sonnet 4.5 (and others).

This is a re-implementation of an experimental previous project that was written by humans; this library's code was largely produced by LLMs with access to the original's code and explanations of the Ops Pattern.

## Quick Start

```typescript
class MainMenuOp extends Op
{
  name = 'MainMenuOp';

  async run(io?: IOContext)
  {
    await Promise.resolve();
    this.log(io, 'Displaying main menu');

    const options = [
      'File Operations',
      'Settings',
      'Help',
      'Exit',
    ] as const;

    const selectOp = new SelectFromListOp(options, { cancelable: false });
    const outcome = await selectOp.run(io);

    if (!outcome.ok)
    {
      // Should not happen since cancelable is false
      return this.fail('menuFailed' as const);
    }

    // Route to appropriate submenu or action
    switch (outcome.value)
    {
      case 'File Operations':
        // Use handleOutcome() to re-run menu if child cancels
        return this.handleOutcome(
          new FileOperationsMenuOp(),
          (outcome) => !outcome.ok && outcome.failure === 'canceled'
        );

      case 'Settings':
        return this.handleOutcome(
          new SettingsMenuOp(),
          (outcome) => !outcome.ok && outcome.failure === 'canceled'
        );

      case 'Help':
        return this.handleOutcome(
          new HelpOp(),
          (outcome) => !outcome.ok && outcome.failure === 'canceled'
        );

      case 'Exit':
        return this.succeed(new ExitOp());

      default:
      {
        // TypeScript knows this is unreachable due to exhaustiveness checking
        const _exhaustive: never = outcome.value;
        return this.failWithUnknownError(`Unknown option: ${String(_exhaustive)}`);
      }
    }
  }
}



// main.ts
async function main()
{
  // Create the initial op
  const initialOp = new WelcomeOp();

  // Create the runner with the initial op and config (async!)
  const runner = await OpRunner.create(initialOp, args.opRunner);

  // Run until the stack is empty!
  await runner.run();
}
import { Op, OpRunner } from './ops';



// Run it
const op = new GreetUserOp();
const runner = await OpRunner.create(op, { mode: 'interactive' });
await runner.run();
```

That's it! You've built your first Ops app.

## Core Concepts

### Everything is an Op

```typescript
class MyOp extends Op {
  name = 'MyOp';

  async run(io?: IOContext) {
    // Do work here

    if (success) {
      return this.succeed(result);
    } else {
      return this.fail('errorType' as const, debugInfo);
    }
  }
}
```

### Ops Chain Together

```typescript
class MenuOp extends Op {
  async run(io?: IOContext) {
    const selectOp = new SelectFromListOp(['Option A', 'Option B']);
    const outcome = await selectOp.run(io);

    if (outcome.ok) {
      // Return the next Op to run
      return this.succeed(new ActionOp(outcome.value));
    }

    return this.cancel();
  }
}
```

The OpRunner handles the stack automatically. No manual orchestration needed.

### Outcome Handlers: Smart Navigation

Use outcome handlers to inspect child Op results and decide what to do next:

```typescript
class MainMenuOp extends Op {
  async run(io?: IOContext) {
    const options = ['Settings', 'Exit'] as const;
    const selectOp = new SelectFromListOp(options);
    const outcome = await selectOp.run(io);

    if (!outcome.ok) return this.fail('menuFailed' as const);

    if (outcome.value === 'Settings') {
      // Re-run menu if settings is canceled
      return this.handleOutcome(
        new SettingsOp(),
        (outcome) => !outcome.ok && outcome.failure === 'canceled'
      );
    }

    return this.succeed(new ExitOp());
  }
}
```

**Handler can return:**
- `true` - Re-run parent (for "back" navigation)
- `false` - Normal completion (pop both)
- `Op` - Replace child with different op

**No circular dependencies!** Child cancels, parent handles it.

### Configuration Management

Store app settings, preferences, and state using config ops:

```typescript
import { setConfigNamespace } from './ConfigContext';
import { ReadConfigOp, WriteConfigOp } from './ops';

// Set namespace once at app startup
setConfigNamespace('my-app');

// Write config
const writeOp = new WriteConfigOp('ui-language', 'en-US');
await writeOp.run();
// Writes to ~/.config/my-app/ui-language.jsonctc

// Read config with default
const readOp = new ReadConfigOp<string>('ui-language', {
  defaultValue: 'en-US'
});
const result = await readOp.run();
if (result.ok) {
  console.log(`Language: ${result.value}`);
}

// Store arrays (e.g., recent URLs)
const urlsWrite = new WriteConfigOp('recent-urls', [
  'https://example.com',
  'https://api.github.com'
]);
```

**Smart location resolution:**
1. Walks up from CWD looking for `.config/<namespace>/`
2. Stops at volume boundary
3. Falls back to `~/.config/<namespace>/`

**Per-component namespaces:**
```typescript
// Library components can have their own config
const pickerOp = new ReadConfigOp('last-directory', {
  namespace: 'com.axhxrx.ops.filepicker'
});
```

### JSONCTC: Preserving Your Comments

Config files use **JSONCTC** format (JSON with Comments and Trailing Commas). The killer feature: **WriteConfigOp preserves your comments** when updating values.

**Why this matters:**
- Config files are human-editable
- Users document their choices with comments
- Apps shouldn't destroy user documentation

**Example:**
```typescript
// User creates ~/.config/my-app/theme.jsonctc with comments:
// {
//   // I prefer dark mode at night
//   "mode": "dark",
//   "contrast": "high",  // easier on my eyes
// }

// App updates the value:
const op = new WriteConfigOp('theme', {
  mode: 'light',
  contrast: 'high'
});
await op.run();

// Result preserves comments!
// {
//   // I prefer dark mode at night  ← PRESERVED!
//   "mode": "light",
//   "contrast": "high",  // easier on my eyes  ← PRESERVED!
// }
```

**🏆 HALL-OF-FAMER RADGUY O.G. WAREZ KINGPIN ACHIEVEMENT:** Comments are preserved at ALL levels - including inside nested objects AND inside arrays! This is the world's first JSONCTC implementation with 100% perfect preservation.

See [JSONCTC.md](./JSONCTC.md) for the full story and technical details of this legendary achievement.

### Type-Safe Data Access with `extract()` and `update()`

The `JSONCTCObject` class provides type-safe methods for reading and writing data without ESLint warnings!

**Problem: `.data` is untyped (returns `any`)**
```typescript
const obj = new JSONCTCObject(jsonStr);
const config = obj.data.options.subsystem.config;
//            ^^^ ESLint: unsafe member access (x3!)
```

**Solution: Use `extract()` for type-safe reads**
```typescript
interface MyConfig {
  hypersonicDrive: { energyUsageLimit: number }
}

const defaultConfig: MyConfig = {
  hypersonicDrive: { energyUsageLimit: 5000 }
};

const obj = new JSONCTCObject(jsonStr);
const config = obj.extract('options.subsystem.config', defaultConfig);
//    ^^ TypeScript infers MyConfig from defaultValue!

config.hypersonicDrive.energyUsageLimit;  // Fully typed, no warnings!
```

**How `extract()` works:**
- Navigate to path (supports `'a.b.c'` or `['a', 'b', 'c']`)
- If missing/wrong type → returns default value
- If both are objects → deep merges (config overrides defaults)
- Type inference from default value (no explicit generics needed!)

**Use `update()` for type-safe writes**
```typescript
obj.update('options.subsystem.config.energyUsageLimit', 9000);
//    ^^ Type-safe! Comments preserved!

console.log(obj.toString());  // Comments still there!
```

**Round-trip example:**
```typescript
// Extract with defaults
const config = obj.extract('server', {
  timeout: 5000,
  retries: 3
});

// Modify
config.timeout = 10000;

// Update back (preserves comments!)
obj.update('server', config);
```

**Benefits:**
- ✅ Type-safe (TypeScript infers from defaults)
- ✅ No ESLint warnings
- ✅ Comments preserved on update
- ✅ Graceful degradation (missing values filled from default)
- ✅ Works with deep nesting

### Strong Typing with `as const`

```typescript
// Strongly-typed failures
return this.fail('networkError' as const);
return this.fail('fileNotFound' as const);

// Exhaustive handling
if (!result.ok) {
  if (result.failure === 'networkError') {
    // TypeScript knows this is a network error
  } else if (result.failure === 'fileNotFound') {
    // TypeScript knows this is a file not found error
  }
  // TypeScript enforces exhaustive checking!
}
```

## Built-in Ops

### UI Primitives
- **SelectFromListOp** - Choose from a list (with arrow keys)
- **InputTextOp** - Text input with validation
- **ConfirmOp** - Yes/No confirmation

### Display
- **PrintOp** - Print text to stdout
- **RenderMarkdownOp** - Render markdown beautifully
- **FilePreviewOp** - Preview files (text, JSON, code with syntax highlighting)

### Network
- **FetchOp** - HTTP requests with smart previews (JSON, HTML→markdown)

### Configuration
- **ReadConfigOp** - Read config from nearest `.config/` directory
- **WriteConfigOp** - Write config with atomic writes
- **ConfigContext** - Set global namespace for your app

### Composition
- **MenuDemo** - Full example of hierarchical menus

## Creating a Full App

```typescript
// main.ts
import { parseOpRunnerArgs } from './args';
import { OpRunner } from './OpRunner';
import { MainMenuOp } from './MainMenuOp';

if (import.meta.main) {
  const { opRunner } = parseOpRunnerArgs(process.argv.slice(2));
  const mainMenu = new MainMenuOp();
  const runner = await OpRunner.create(mainMenu, opRunner);
  await runner.run();
}
```

Run it:
```bash
bun main.ts                    # Interactive mode (Bun)
deno run -A main.ts            # Interactive mode (Deno)
bun main.ts --record session   # Record inputs
bun main.ts --replay session   # Replay session
```

## Cross-Runtime Support

This library works with both **Bun** and **Deno**:

### Bun (Primary)
```bash
bun main.ts
bun MenuDemo.tsx
```

### Deno
```bash
deno run -A main.ts
deno task dev  # Uses deno.json task
```

**Key compatibility notes:**
- JSX is configured for React in both runtimes
- React version is pinned to 19.1.1 (matches Ink's peer dependency)
- All npm dependencies are mapped in `deno.json` for Deno
- Both runtimes share the same TypeScript config style

**Why React 19.1.1?**
The library uses [Ink](https://github.com/vadimdemedes/ink) for terminal UI, which requires React 19.x. To avoid the classic "multiple React instances" problem in Deno, we pin to the exact version that Ink expects (19.1.1). This ensures React hooks work correctly across both runtimes.

## Examples

Check out the demos:
```bash
bun MenuDemo.tsx              # Hierarchical menus
bun OutcomeHandlerTest.tsx    # Outcome handler patterns
bun FilePreviewOp.tsx         # File previews
bun FetchOp.tsx               # HTTP requests
bun FetchOp.tsx <url>         # Fetch and preview any URL
bun ReadConfigOp.ts <key>     # Read config value
bun WriteConfigOp.ts <key> <value>  # Write config value
```

## Key Features

- **🎯 Simple** - Write less code, focus on logic
- **🔗 Composable** - Ops chain naturally
- **✅ Testable** - Each Op is independently testable
- **📊 Observable** - OpRunner logs every operation
- **🎬 Replayable** - Record and replay sessions for testing
- **🔒 Type-safe** - Strong failure typing with TypeScript
- **🎨 Beautiful UI** - Built on Ink for rich terminal interfaces

## Documentation

- **[OPS_PATTERN.md](./OPS_PATTERN.md)** - Deep dive into the pattern
- **[MENU_PATTERNS.md](./MENU_PATTERNS.md)** - Menu hierarchies, file previews, API integration

## Philosophy

The Ops Pattern removes choices and enforces simplicity:
- One way to structure work (Ops)
- One way to return results (Outcomes)
- One way to compose (return the next Op)
- One way to execute (OpRunner)

This constraint makes codebases maintainable, testable, and easy to understand.

## Running Ops Standalone

Every Op can run independently:
```bash
./PrintOp.ts
./SelectFromListOp.tsx
./FetchOp.tsx https://api.github.com/users/octocat
```

Perfect for debugging and development.

NOMERGE: testing nomerge 3

## License

MIT

## Happenings

- 2025-10-26: 🚀 release: 666.420.6971 — fix up the IOContext and OpRunner to make it easier for the 🤖🤖🤖 to record and playback their own interactive CLI sessions, to get feedback loop they can self-manage

- 2025-10-26: 🚀 release: 666.420.6970 — more Deno compatibility, easier `--record`  and `--replay` for CLI apps using this lib

- 2025-10-25: 🤖 release 666.420.69 now works (for some values of "works") with 🥟 Bun and 🦕 Deno
