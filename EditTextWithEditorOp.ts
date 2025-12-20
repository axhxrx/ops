#!/usr/bin/env bun

import { EditTextOp, type EditTextOpOptions } from './EditTextOp.tsx';
import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';
import { which } from './runtime-utils.ts';
import { type RichOption, SelectFromListOp } from './SelectFromListOp.tsx';

/**
 Known editors with their commands and detection methods
 */
const KNOWN_EDITORS = [
  { name: 'VS Code', command: 'code --wait', executable: 'code' },
  { name: 'Cursor', command: 'cursor --wait', executable: 'cursor' },
  { name: 'Zed', command: 'zed --wait', executable: 'zed' },
  { name: 'Windsurf', command: 'windsurf --wait', executable: 'windsurf' },
  { name: 'Vim', command: 'vim', executable: 'vim' },
  { name: 'Nano', command: 'nano', executable: 'nano' },
  { name: 'Emacs', command: 'emacs -nw', executable: 'emacs' },
] as const;

/**
 Options for EditTextWithEditorOp
 */
export type EditTextWithEditorOpOptions = Omit<EditTextOpOptions, 'externalEditor'> & {
  /**
   Force a specific editor instead of showing the menu
   */
  forceEditor?: string;
};

/**
 EditTextWithEditorOp - Smart text editor that detects available editors and offers a choice

 Automatically detects available editors on the system (VS Code, Vim, etc.) and presents
 a menu to choose between them or use the built-in terminal editor.

 Success value: string (the edited text)
 Failure: 'canceled' if user cancels

 @example Auto-detect and show menu
 ```typescript
 const op = new EditTextWithEditorOp('Enter your message:', {
   initialValue: 'Hello, world!',
   cancelable: true,
 });
 const result = await op.run();

 if (result.ok) {
   console.log('Text:', result.value);
 }
 ```

 @example Force a specific editor
 ```typescript
 const op = new EditTextWithEditorOp('Enter your message:', {
   forceEditor: 'vim',
   initialValue: 'Hello, world!',
 });
 ```
 */
export class EditTextWithEditorOp extends Op
{
  name = 'EditTextWithEditorOp';

  constructor(
    private prompt: string,
    private options: EditTextWithEditorOpOptions = {},
  )
  {
    super();
  }

  /**
   Detect which editors are available on the system
   */
  private detectAvailableEditors(io?: IOContext): string[]
  {
    const available: string[] = [];

    // Check $EDITOR environment variable
    const envEditor = process.env['EDITOR'];
    if (envEditor)
    {
      this.log(io, `Found EDITOR environment variable: ${envEditor}`);
      available.push(envEditor);
    }

    // Check each known editor
    for (const editor of KNOWN_EDITORS)
    {
      try
      {
        const editorPath = which(editor.executable);
        if (editorPath)
        {
          this.log(io, `Found ${editor.name}: ${editorPath}`);
          // Don't add duplicates (e.g., if $EDITOR is 'vim' and we also found vim)
          if (!available.includes(editor.command))
          {
            available.push(editor.command);
          }
        }
      }
      catch
      {
        // Editor not found, skip
      }
    }

    return available;
  }

  /**
   Get a friendly name for an editor command
   */
  private getEditorName(command: string): string
  {
    // Check if it matches a known editor
    const known = KNOWN_EDITORS.find((e) => command.startsWith(e.executable));
    if (known)
    {
      return known.name;
    }

    // Otherwise use the command itself
    return command;
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();

    // If user forced a specific editor, use it directly
    if (this.options.forceEditor)
    {
      this.log(io, `Using forced editor: ${this.options.forceEditor}`);
      const editOp = new EditTextOp(this.prompt, {
        ...this.options,
        externalEditor: this.options.forceEditor,
      });
      return editOp.run(io);
    }

    // Detect available editors
    const availableEditors = this.detectAvailableEditors(io);

    // Build menu options
    type EditorChoice = RichOption<{ type: 'external'; command: string } | { type: 'builtin' }>;
    const menuOptions: EditorChoice[] = [];

    // Add built-in editor first
    menuOptions.push({
      title: '[B]uilt-in editor',
      value: { type: 'builtin' },
      key: 'b',
      helpText: 'Use the built-in terminal text editor (simple, works everywhere)',
    });

    // Add detected editors
    const editorKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (let i = 0; i < availableEditors.length && i < editorKeys.length; i++)
    {
      const command = availableEditors[i]!;
      const name = this.getEditorName(command);
      const key = editorKeys[i]!;

      menuOptions.push({
        title: `[${key}] ${name}`,
        value: { type: 'external', command },
        key,
        helpText: `Use ${name}: ${command}`,
      });
    }

    // Show menu
    const menuOp = new SelectFromListOp(menuOptions, { cancelable: this.options.cancelable });
    const menuResult = await menuOp.run(io);

    if (!menuResult.ok)
    {
      return this.cancel();
    }

    const choice = menuResult.value;
    const choiceValue = choice.value;

    // Type guard to ensure value exists
    if (!choiceValue)
    {
      return this.failWithUnknownError('No editor choice selected');
    }

    // Handle the choice
    if (choiceValue.type === 'builtin')
    {
      this.log(io, 'Using built-in editor');
      const editOp = new EditTextOp(this.prompt, this.options);
      return editOp.run(io);
    }
    else
    {
      this.log(io, `Using external editor: ${choiceValue.command}`);
      const editOp = new EditTextOp(this.prompt, {
        ...this.options,
        externalEditor: choiceValue.command,
      });
      return editOp.run(io);
    }
  }
}

if (import.meta.main)
{
  console.log('='.repeat(80));
  console.log('EditTextWithEditorOp Examples');
  console.log('='.repeat(80));
  console.log();

  // Check for CLI argument to force an editor
  const args = process.argv.slice(2);
  const forceEditor = args[0];

  if (forceEditor)
  {
    console.log(`Forcing editor: ${forceEditor}\n`);
    const op = new EditTextWithEditorOp('Enter your message:', {
      forceEditor,
      initialValue: 'This is a test.\nYou can edit this text.',
      cancelable: true,
    });

    const result = await op.run();

    if (result.ok)
    {
      console.log('\n✅ Result:');
      console.log('─'.repeat(80));
      console.log(result.value);
      console.log('─'.repeat(80));
    }
    else if (result.failure === 'canceled')
    {
      console.log('\n🚫 Canceled');
    }
  }
  else
  {
    console.log('Auto-detecting available editors...\n');
    console.log('You can also pass an editor as a CLI argument:');
    console.log('  bun EditTextWithEditorOp.ts vim');
    console.log('  bun EditTextWithEditorOp.ts "code --wait"');
    console.log('  bun EditTextWithEditorOp.ts nano\n');
    console.log('='.repeat(80));
    console.log();

    const op = new EditTextWithEditorOp('Enter your message:', {
      initialValue: 'This is a test.\nYou can edit this text.\n\nTry the built-in editor or choose an external one!',
      cancelable: true,
      minLength: 5,
    });

    const result = await op.run();

    if (result.ok)
    {
      console.log('\n✅ Result:');
      console.log('─'.repeat(80));
      console.log(result.value);
      console.log('─'.repeat(80));
      console.log(`\nLength: ${result.value.length} characters, ${result.value.split('\n').length} lines`);
    }
    else if (result.failure === 'canceled')
    {
      console.log('\n🚫 Canceled');
    }
    else
    {
      console.log('\n❓ Error:', result.failure, result.debugData);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Done!');
  console.log('='.repeat(80));
}
