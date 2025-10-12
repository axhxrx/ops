# Ops Pattern

## Overview

This project provides some basic building blocks for CLI apps, using an **Ops Pattern** - a composable, chainable architecture for building CLI applications where every action is an Op. Ops can be short UI interactions (e.g. "Are you sure you want to delete this item? [Y/n]", or "Enter your password:"), or non-interactive business logic like creating files or making sequences of API calls, or compositions of other Ops.

## Core Concepts

### 1. Everything is an Op

Ops are the fundamental building blocks of the application. They:
- Encapsulate a single unit of work
- Return a standardized `Outcome<T>`
- Can be composed into chains
- Are independently testable and runnable
- Are auditable and observable and loggable
- Provide a standardized structure to the app by "removing choices and doing things in one consistent way" — enforced simplification of the application's logic.

### 2. Op Types

```
Op (abstract base class)
├── UIOp (we might end up with a base class for UI ops, or not)
│   └── UI Primitives (SelecFromListtOp, InputTextOp, etc.)
├── MenuOp (for menu systems)
│   └── MainMenuOp, BenchmarkOptionsMenuOp
└── Business Ops
    └── BenchOp, CompareOp
```

### 3. Op Chaining and stack-based execution

Ops naturally chain together, conceptually ops can run other ops as part of their own execution.
```typescript
MainMenuOp → BenchmarkOptionsMenuOp → BenchOp
```
HOWEVER! The `OpRunner` runs ops based on a **stack**, where each Op can return another Op to push onto the stack (REPLACING the returning op) and run next. Or, they can "run other ops" as part of their own execution, but even this involves pushing the new ops onto the stack (in this case, not replacing the first op, so that the result of the new op is returned to the first op).

This radically simplifies instrumenting ops with logging, middleware (in future), error handling, and observability and testing. Ops can be tested based on what they return, without actually executing the ops they might return.

## Key Implementation Details

### Op Outcome Pattern

Every Op returns:
```typescript
export type Outcome<SuccessT, FailureT> =
  | Success<SuccessT>
  | Failure<FailureT>;
```

This is a result type that simplifies the logic of ops, allowing them to return a success outcome (with a single value type) or failure outcome with a strongly-typed failure type that can be exhaustively handled, thanks to TypeScript's type system and using `as const` failure values (strings).

### UI Primitives

These are just ideas, may differ slightly from what we actually have
- **InputTextOp**: Text input with validation
- **SelectOp**: Choice from list
- **ConfirmOp**: Yes/No/More Info
- **ShowInfoOp**: Display information
- **InputPasswordOp**: Masked password input
- **InputMultipleTextOp**: Multi-field forms

### API Ops
e.g.
- OAuthAuthenticateOp
- LogOntoBanksAndScrapeBalancesOp
- PostToMastodonOp
- CreateNewGitHubRepoOp

### Simulated Input System (IOContext)

Ops support both interactive and automated "replay" modes. This is FANTASTICALLY USEFUL for testing and debugging. It lets us record a session, capturing the outputs of a sequence of ops, and the user inputs of the user. Then we can run the program again, replaying that session.

This is a form of automation, and then the app returns to interactive mode at the end of the session. This can ALSO be used to run tests, and usefully assert that the textual output of the program matches expectations. It's a form of snapshot testing for arbitrary CLI interactive sessions!

### Ops as Standalone Programs

Every Op should be able to run independently, if invoked as a CLI script. This may not yet be implemented for all ops, but it should be.
```bash

➜  ops git:(main) ✗ ./PrintOp.ts
PrintOp can print to stdout! This is the proof! 💪%                                                                  ➜  ops git:(main) ✗ bun PrintOp.ts
PrintOp can print to stdout! This is the proof! 💪%                                                                  ➜  ops git:(main) ✗ bun ./PrintOp.ts

# Run with simulated inputs for testing
deno run src/ops/ui/primitives/SelectOp.ts --inputs "select:2"
```

This is achieved with code like this:
```typescript
// In PrintOp.ts
if (import.meta.main)
{
  const op = new PrintOp('PrintOp can print to stdout! This is the proof! 💪\n');
  const outcome1 = await op.run();
  const outcome2 = await PrintOp.run(
    'But it cannot print PROHIBITED words..',
    ['PROHIBITED'],
  );
  if (outcome1.ok && !outcome2.ok && outcome2.failure === 'ProhibitedWord')
  {
    await PrintOp.run('Success! Exiting.');
  }
  else
  {
    throw new Error('Operation failed!');
  }
}
```

## Conclusion

The Ops Pattern provides a powerful, flexible foundation for building complex CLI applications. By treating everything as a composable Op, the codebase remains maintainable, testable, and extensible.
