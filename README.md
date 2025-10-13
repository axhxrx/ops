# ops

This is mostly an experiment in patterns to help elicit more useful outputs from coding LLMs. YMMV.

## What is This?

The Ops Pattern is a simplification pattern that provides a constrained, fewer-choices-to-make way to structure CLI applications. Every action — from basic user interactions like confirmation prompts abd menus, to making network requests, to executing subcommands or processsing files, or whatever business logic, is implemented as an **Op** that returns a standardized `Outcome`.

Ops compose naturally, are independently testable, often also independently runnable as command-line tools, and provide a framework for implementing observability, monitoring, and logging.

But the main point of them is that they force as much of the software as possible into the same basic pattern, which is not super-annoying for a human (maybe a little bit, though) and seems to provide the simplicity and testability to make it easier for LLMs to... whatever it is they do that seems like _reasoning_, about the code. It's a pattern that has yielded better useful results, and fewer useless or harmful results, from 2025-era coding LLMs like GPT5- Codex and Claude Sonnet 4.5 (and others).

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

### Composition
- **MenuDemo** - Full example of hierarchical menus

## Creating a Full App

```typescript
// main.ts
import { parseOpRunnerArgs } from './args';
import { OpRunner } from './OpRunner';
import { MainMenuOp } from './MainMenuOp';

if (import.meta.main) {
  const { opRunner } = parseOpRunnerArgs(Bun.argv.slice(2));
  const mainMenu = new MainMenuOp();
  const runner = await OpRunner.create(mainMenu, opRunner);
  await runner.run();
}
```

Run it:
```bash
bun main.ts                    # Interactive mode
bun main.ts --record session   # Record inputs
bun main.ts --replay session   # Replay session
```

## Examples

Check out the demos:
```bash
bun MenuDemo.tsx              # Hierarchical menus
bun OutcomeHandlerTest.tsx    # Outcome handler patterns
bun FilePreviewOp.tsx         # File previews
bun FetchOp.tsx               # HTTP requests
bun FetchOp.tsx <url>         # Fetch and preview any URL
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

## License

MIT
