# Menu Patterns - Making Hierarchical Menus EASY

This document demonstrates patterns for creating hierarchical menus and file previews in the Ops Pattern.

## Key Components

### 1. FilePreviewOp

A reusable op for previewing text-based files with appropriate formatting.

**Supported formats:**
- `.md` / `.markdown` - Beautiful markdown rendering with syntax highlighting
- `.json` - Pretty-printed JSON with indentation
- `.yml` / `.yaml` - YAML files displayed as-is
- `.txt`, `.log`, `.ts`, `.tsx`, `.js`, etc. - Plain text display

**Usage:**
```typescript
const previewOp = new FilePreviewOp('./README.md');
const outcome = await previewOp.run();

if (outcome.ok) {
  // File displayed successfully
} else if (outcome.failure === 'fileNotFound') {
  console.log('File not found');
} else if (outcome.failure === 'unsupportedFormat') {
  console.log('Format not supported');
}
```

**Try it:**
```bash
bun FilePreviewOp.tsx
```

### 2. Hierarchical Menu Pattern

The key insight: **Each menu level is just an Op that returns the next Op.**

This makes menu hierarchies incredibly simple:

```typescript
class MainMenuOp extends Op {
  async run(io?: IOContext) {
    const options = ['Submenu A', 'Submenu B', 'Exit'] as const;
    const selectOp = new SelectFromListOp(options);
    const outcome = await selectOp.run(io);

    if (!outcome.ok) return this.fail('menuFailed' as const);

    // Simply return the next Op based on selection!
    switch (outcome.value) {
      case 'Submenu A':
        return this.succeed(new SubmenuAOp());
      case 'Submenu B':
        return this.succeed(new SubmenuBOp());
      case 'Exit':
        return this.succeed(undefined); // Exit
    }
  }
}

class SubmenuAOp extends Op {
  async run(io?: IOContext) {
    const options = ['Action 1', 'Action 2', 'Back'] as const;
    const selectOp = new SelectFromListOp(options, { cancelable: true });
    const outcome = await selectOp.run(io);

    // Escape key or "Back" returns to parent menu
    if (!outcome.ok || outcome.value === 'Back') {
      return this.succeed(new MainMenuOp());
    }

    // Handle actions...
    switch (outcome.value) {
      case 'Action 1':
        return this.succeed(new Action1Op());
      case 'Action 2':
        return this.succeed(new Action2Op());
    }
  }
}
```

## Demo: Interactive Menu System

Run the full demo to see it all in action:

```bash
bun MenuDemo.tsx
```

The demo includes:
- **Main Menu** with multiple top-level options
- **File Operations submenu** with file preview integration
- **Settings submenu** with dummy actions
- **Help screen** with documentation
- **Escape key navigation** to go back to parent menus
- **Error handling** (e.g., file not found)

### Menu Structure

```
Main Menu
├─ File Operations
│   ├─ Preview OPS_PATTERN.md
│   ├─ Preview package.json
│   ├─ Preview README (demo: file not found)
│   └─ Back to Main Menu
├─ Settings
│   ├─ Toggle Dark Mode (demo)
│   ├─ Change Language (demo)
│   ├─ Clear Cache (demo)
│   └─ Back to Main Menu
├─ Help
└─ Exit
```

## Why This Pattern is EASY

### 1. No Complex State Management
Each menu is independent. No shared state, no complex routing logic.

### 2. Composable Ops
Mix menus, actions, and UI ops freely. They all follow the same pattern.

### 3. Type-Safe Navigation
TypeScript ensures exhaustive handling of menu options via `as const` arrays.

### 4. Easy to Test
Each menu op can be tested independently:
```typescript
const menuOp = new MainMenuOp();
const outcome = await menuOp.run(mockIOContext);
expect(outcome.ok).toBe(true);
expect(outcome.value).toBeInstanceOf(SubmenuAOp);
```

### 5. Clear Intent
Just read the code - it's obvious what happens when you select each option.

## Pattern: Integrating with FilePreviewOp

Here's how to preview a file and return to the menu:

```typescript
class PreviewFileOp extends Op {
  constructor(private filePath: string) {
    super();
  }

  async run(io?: IOContext) {
    const previewOp = new FilePreviewOp(this.filePath);
    const outcome = await previewOp.run(io);

    if (!outcome.ok) {
      // Show error message
      const { stdout } = this.getIO(io);
      stdout.write(`\n❌ Error: ${outcome.failure}\n`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // If markdown, outcome.value is RenderMarkdownOp - run it
    if (outcome.ok && outcome.value && 'run' in outcome.value) {
      await (outcome.value as Op).run(io);
    }

    // Return to previous menu
    return this.succeed(new FileOperationsMenuOp());
  }
}
```

## Important: stdin Handling and Ink

### The Problem

**DO NOT manually manipulate stdin when using Ink components!**

Manual stdin handling (e.g., `stdin.resume()`, `stdin.on('data', ...)`) will interfere with Ink's keyboard handling and cause freezes, unresponsive menus, and other bizarre behavior.

This is especially important because this library is designed to work across multiple runtimes (Bun, Deno, Node.js), and stdin handling has subtle differences between them. Mixing manual stdin handling with Ink creates edge cases that are hard to debug.

### The Solution

**Always use Ink components for user input.** Ink handles stdin properly and works consistently across runtimes.

#### ❌ WRONG - Manual stdin handling:
```typescript
class HelpOp extends Op {
  async run(io?: IOContext) {
    const { stdin, stdout } = this.getIO(io);
    stdout.write('Press Enter to continue...');

    // ❌ This will break Ink components that run after!
    stdin.resume();
    await new Promise<void>((resolve) => {
      stdin.on('data', () => resolve());
    });

    return this.succeed(new MainMenuOp());
  }
}
```

#### ✅ RIGHT - Use Ink component:
```typescript
const HelpDisplay = ({ onDone }: { onDone: () => void }) => {
  let dismissed = false;

  useInput((_input, key) => {
    if (!dismissed && key.return) {
      dismissed = true;
      onDone();
    }
  });

  return <Text>Help text here...\nPress Enter to continue</Text>;
};

class HelpOp extends Op {
  async run(io?: IOContext) {
    let done = false;

    const { unmount, waitUntilExit } = render(
      <HelpDisplay onDone={() => {
        done = true;
        unmount();
      }} />
    );

    await waitUntilExit();

    if (!done) return this.failWithUnknownError('Display incomplete');
    return this.succeed(new MainMenuOp());
  }
}
```

### When to Use Ink

Use Ink components for:
- ✅ Menus (SelectFromListOp)
- ✅ Text input (InputTextOp)
- ✅ Confirmations (ConfirmOp)
- ✅ File previews (FilePreviewOp, RenderMarkdownOp)
- ✅ Any UI that needs keyboard input

### When You Can Skip Ink

You can write directly to stdout for:
- ✅ Simple messages (PrintOp)
- ✅ Progress indicators that don't need input
- ✅ Final output after all interaction is done

**Golden Rule:** If it needs to wait for a keypress, use an Ink component with `useInput`.

## Next Steps: File Browser

The natural next step would be a **FileSystemBrowserOp** that lets you:
- Navigate directories
- Select files
- Preview selected files
- Navigate back up the directory tree

This would follow the same pattern - just another Op that returns other Ops based on user selections!

## Key Takeaways

1. **Menus are just Ops** that return other Ops
2. **Navigation is handled by returning the next Op** to run
3. **Escape key + "Back" option** provide intuitive navigation
4. **FilePreviewOp** makes file confirmation EASY
5. **The pattern scales** - add more menus by adding more Ops
6. **Always use Ink for user input** - don't touch stdin directly

The Ops Pattern's stack-based execution naturally supports hierarchical navigation!
