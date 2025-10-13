#!/usr/bin/env bun

/**
 MenuDemo - Demonstrates hierarchical menus and file preview integration

 This demo shows:
 - Main menu with multiple options
 - Submenus that can navigate back to parent
 - Integration with FilePreviewOp
 - Clean, composable menu structure

 Run with: bun MenuDemo.tsx
 */

import { render } from 'ink';
import { Text, useInput } from 'ink';
import { parseOpRunnerArgs } from './args';
import { FilePreviewOp } from './FilePreviewOp';
import type { IOContext } from './IOContext';
import { Op } from './Op';
import { OpRunner } from './OpRunner';
import type { Failure, Success } from './Outcome';
import { SelectFromListOp } from './SelectFromListOp';

/**
 Entry point op - shows the main menu
 */
class MainMenuOp extends Op
{
  name = 'MainMenuOp';

  async run(io?: IOContext): Promise<Success<Op> | Failure<'menuFailed' | 'unknownError'>>
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
        return this.succeed(new FileOperationsMenuOp());

      case 'Settings':
        return this.succeed(new SettingsMenuOp());

      case 'Help':
        return this.succeed(new HelpOp());

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

/**
 File Operations submenu
 */
class FileOperationsMenuOp extends Op
{
  name = 'FileOperationsMenuOp';

  async run(io?: IOContext): Promise<Success<Op> | Failure<'menuFailed' | 'unknownError'>>
  {
    await Promise.resolve();
    this.log(io, 'Displaying file operations menu');

    const options = [
      'Preview OPS_PATTERN.md',
      'Preview package.json',
      'Preview README (demo: file not found)',
      'Back to Main Menu',
    ] as const;

    const selectOp = new SelectFromListOp(options, { cancelable: true });
    const outcome = await selectOp.run(io);

    if (!outcome.ok)
    {
      // User pressed Escape - go back to main menu
      return this.succeed(new MainMenuOp());
    }

    // Route to appropriate action
    switch (outcome.value)
    {
      case 'Preview OPS_PATTERN.md':
        return this.succeed(new PreviewFileOp('./OPS_PATTERN.md'));

      case 'Preview package.json':
        return this.succeed(new PreviewFileOp('./package.json'));

      case 'Preview README (demo: file not found)':
        return this.succeed(new PreviewFileOp('./README_DOES_NOT_EXIST.md'));

      case 'Back to Main Menu':
        return this.succeed(new MainMenuOp());

      default:
      {
        const _exhaustive: never = outcome.value;
        return this.failWithUnknownError(`Unknown option: ${String(_exhaustive)}`);
      }
    }
  }
}

/**
 Settings submenu
 */
class SettingsMenuOp extends Op
{
  name = 'SettingsMenuOp';

  async run(io?: IOContext)
  {
    await Promise.resolve();
    this.log(io, 'Displaying settings menu');

    const options = [
      'Toggle Dark Mode (demo)',
      'Change Language (demo)',
      'Clear Cache (demo)',
      'Back to Main Menu',
    ] as const;

    const selectOp = new SelectFromListOp(options, { cancelable: true });
    const outcome = await selectOp.run(io);

    if (!outcome.ok)
    {
      // User pressed Escape - go back to main menu
      return this.succeed(new MainMenuOp());
    }

    // Handle settings actions
    switch (outcome.value)
    {
      case 'Toggle Dark Mode (demo)':
        return this.succeed(new SettingChangedOp('Dark mode toggled!'));

      case 'Change Language (demo)':
        return this.succeed(new SettingChangedOp('Language changed!'));

      case 'Clear Cache (demo)':
        return this.succeed(new SettingChangedOp('Cache cleared!'));

      case 'Back to Main Menu':
        return this.succeed(new MainMenuOp());

      default:
      {
        const _exhaustive: never = outcome.value;
        return this.failWithUnknownError(`Unknown option: ${String(_exhaustive)}`);
      }
    }
  }
}

/**
 Show a setting change message and return to settings menu
 */
class SettingChangedOp extends Op
{
  name = 'SettingChangedOp';

  constructor(private message: string)
  {
    super();
  }

  async run(io?: IOContext)
  {
    const { stdout } = this.getIO(io);
    stdout.write(`\n✅ ${this.message}\n\n`);
    await new Promise(resolve => setTimeout(resolve, 800));
    return this.succeed(new SettingsMenuOp());
  }
}

/**
 Preview a file and return to file operations menu
 */
class PreviewFileOp extends Op
{
  name = 'PreviewFileOp';

  constructor(private filePath: string)
  {
    super();
  }

  async run(io?: IOContext)
  {
    const previewOp = new FilePreviewOp(this.filePath);
    const outcome = await previewOp.run(io);

    if (!outcome.ok)
    {
      // Handle preview errors
      const { stdout } = this.getIO(io);
      let errorMessage = 'Unknown error';

      if (outcome.failure === 'fileNotFound')
      {
        errorMessage = `File not found: ${outcome.debugData}`;
      }
      else if (outcome.failure === 'fileTooLarge')
      {
        errorMessage = `File too large: ${outcome.debugData}`;
      }
      else if (outcome.failure === 'notUtf8Text')
      {
        errorMessage = `Not UTF-8 text: ${outcome.debugData}`;
      }
      else if (outcome.failure === 'readError')
      {
        errorMessage = `Read error: ${outcome.debugData}`;
      }

      stdout.write(`\n❌ ${errorMessage}\n`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      return this.succeed(new FileOperationsMenuOp());
    }

    // If preview succeeded and returned another op (markdown case), run it
    if (outcome.value && typeof outcome.value === 'object' && 'run' in outcome.value)
    {
      await (outcome.value as Op).run(io);
    }

    // Return to file operations menu
    return this.succeed(new FileOperationsMenuOp());
  }
}

/**
 Simple Ink component to display help and wait for Enter
 */
const HelpDisplay = ({ onDone }: { onDone: () => void }) =>
{
  let dismissed = false;

  useInput((_input, key) =>
  {
    if (!dismissed && key.return)
    {
      dismissed = true;
      onDone();
    }
  });

  return (
    <>
      <Text>
        {`
╔════════════════════════════════════════════════════════════╗
║                     MENU DEMO HELP                         ║
╚════════════════════════════════════════════════════════════╝

This demo showcases hierarchical menus in the Ops Pattern.

NAVIGATION:
  ↑/↓     : Navigate menu items
  Enter   : Select an item
  Escape  : Go back (in submenus)

MENU STRUCTURE:
  Main Menu
    ├─ File Operations
    │   ├─ Preview OPS_PATTERN.md
    │   ├─ Preview package.json
    │   └─ Back to Main Menu
    ├─ Settings
    │   ├─ Various settings options
    │   └─ Back to Main Menu
    ├─ Help (this page)
    └─ Exit

KEY PATTERNS DEMONSTRATED:
  1. Hierarchical navigation with parent/child menus
  2. File preview integration (markdown, JSON, etc.)
  3. Error handling (file not found)
  4. Escape key navigation back to parent menus
  5. Clean, composable Op structure
`}
      </Text>
      <Text dimColor italic>
        {'\nPress Enter to return to main menu...'}
      </Text>
    </>
  );
};

/**
 Display help information
 */
class HelpOp extends Op
{
  name = 'HelpOp';

  async run(_io?: IOContext)
  {
    let done = false;

    const { unmount, waitUntilExit } = render(
      <HelpDisplay
        onDone={() =>
        {
          done = true;
          unmount();
        }}
      />,
    );

    await waitUntilExit();

    if (!done)
    {
      return this.failWithUnknownError('Help display did not complete');
    }

    return this.succeed(new MainMenuOp());
  }
}

/**
 Exit the application
 */
class ExitOp extends Op
{
  name = 'ExitOp';

  async run(io?: IOContext)
  {
    const { stdout } = this.getIO(io);
    stdout.write('\n👋 Goodbye! Thanks for trying the menu demo.\n\n');
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.succeed(undefined);
  }
}

if (import.meta.main)
{
  console.log('🎯 Hierarchical Menu Demo\n');
  console.log('Demonstrating easy menu setup and navigation...\n');

  const { opRunner } = parseOpRunnerArgs(Bun.argv.slice(2));
  const mainMenu = new MainMenuOp();
  const runner = await OpRunner.create(mainMenu, opRunner);
  await runner.run();
}
