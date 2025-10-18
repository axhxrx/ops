#!/usr/bin/env bun

import { render } from 'ink';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import type { IOContext } from './IOContext';
import { Op } from './Op';
import { EditTextInput } from './EditTextOp.ui';

/**
 Options for EditTextOp
 */
export type EditTextOpOptions = {
  /**
   Allow user to press Escape to cancel (Default: false)
   */
  cancelable?: boolean;

  /**
   Initial text content
   */
  initialValue?: string;

  /**
   Minimum length validation (Default: no minimum)
   */
  minLength?: number;

  /**
   Maximum length validation (Default: no maximum)
   */
  maxLength?: number;

  /**
   Custom validation function. Return error message if invalid, undefined if valid.

   @param value - The text content
   @returns Error message if invalid, undefined if valid
   */
  validator?: (value: string) => string | undefined;

  /**
   External editor command. If provided, offers to open this editor instead of using the built-in editor.

   Examples:
   - 'vim' or 'nano' for CLI editors
   - 'code --wait' for VS Code (--wait makes it block until file is closed)
   - 'zed --wait' for Zed
   - 'cursor --wait' for Cursor

   Note: GUI editors require the --wait flag (or equivalent) to block until the file is closed.
   */
  externalEditor?: string;
};

/**
 EditTextOp - Multiline text editor for terminal

 A simple text editor that allows users to input or edit multiple lines of text
 without requiring an external editor. Useful for prompting users for paragraph-length
 input, markdown content, code snippets, etc.

 Features:
 - Multiline editing with cursor movement
 - Automatic scrolling for long content
 - Terminal resize handling
 - Line wrapping for long lines
 - Optional validation
 - Ctrl+S to save, Escape to cancel

 Success value: string (the edited text)
 Failure: 'canceled' if user presses Escape (when cancelable: true)

 @example Simple text editing
 ```typescript
 const op = new EditTextOp('Enter your message:', {
   cancelable: true,
   minLength: 10,
 });
 const result = await op.run();

 if (result.ok) {
   console.log('Message:', result.value);
 } else if (result.failure === 'canceled') {
   console.log('User canceled');
 }
 ```

 @example Editing existing content
 ```typescript
 const existingText = 'Hello, world!\nThis is a test.';
 const op = new EditTextOp('Edit the message:', {
   initialValue: existingText,
   cancelable: true,
 });
 const result = await op.run();

 if (result.ok) {
   console.log('Updated:', result.value);
 }
 ```

 @example With validation
 ```typescript
 const op = new EditTextOp('Enter JSON:', {
   validator: (value) => {
     try {
       JSON.parse(value);
       return undefined;
     } catch {
       return 'Invalid JSON';
     }
   },
   cancelable: true,
 });
 ```
 */
export class EditTextOp extends Op
{
  name = 'EditTextOp';

  constructor(
    private prompt: string,
    private options: EditTextOpOptions = {},
  )
  {
    super();
  }

  /**
   Run with external editor (vim, VS Code, etc.)
   */
  private async runWithExternalEditor(io?: IOContext)
  {
    // Create temp file path
    const tempFile = join(tmpdir(), `edit-text-${Date.now()}.txt`);

    try
    {
      // Write initial content to temp file
      await Bun.write(tempFile, this.options.initialValue ?? '');

      this.log(io, `Opening ${this.options.externalEditor} with temp file: ${tempFile}`);

      // Parse editor command (handle commands with args like "code --wait")
      const editorParts = this.options.externalEditor!.split(' ');
      const editorCmd = editorParts[0]!;
      const editorArgs = [...editorParts.slice(1), tempFile];

      // Spawn editor and wait for it to exit
      const proc = Bun.spawn({
        cmd: [editorCmd, ...editorArgs],
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
      });

      const exitCode = await proc.exited;

      if (exitCode !== 0)
      {
        this.warn(io, `Editor exited with code ${exitCode}`);
        if (this.options.cancelable)
        {
          return this.cancel();
        }
        return this.failWithUnknownError(`Editor exited with code ${exitCode}`);
      }

      // Read edited content
      const file = Bun.file(tempFile);
      const content = await file.text();

      this.log(io, `Read ${content.length} characters from temp file`);

      // Validate if validator is provided
      if (this.options.validator)
      {
        const error = this.options.validator(content);
        if (error)
        {
          return this.fail('validationFailed' as const, error);
        }
      }

      // Min/max length validation
      if (this.options.minLength !== undefined && content.length < this.options.minLength)
      {
        return this.fail('validationFailed' as const, `Must be at least ${this.options.minLength} characters`);
      }
      if (this.options.maxLength !== undefined && content.length > this.options.maxLength)
      {
        return this.fail('validationFailed' as const, `Must be at most ${this.options.maxLength} characters`);
      }

      return this.succeed(content);
    }
    catch (error: unknown)
    {
      this.error(io, `Failed to run external editor: ${String(error)}`);
      return this.failWithUnknownError(`Failed to run external editor: ${String(error)}`);
    }
    finally
    {
      // Clean up temp file
      try
      {
        await unlink(tempFile);
        this.log(io, `Cleaned up temp file: ${tempFile}`);
      }
      catch
      {
        // Ignore cleanup errors
      }
    }
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();
    const ioContext = this.getIO(io);

    // If external editor is configured, use it instead
    if (this.options.externalEditor)
    {
      return this.runWithExternalEditor(io);
    }

    let resultValue: string | null = null;
    let wasCanceled = false;

    // Build composite validator from options
    const validator = (value: string): string | undefined =>
    {
      // Min length check
      if (this.options.minLength !== undefined && value.length < this.options.minLength)
      {
        return `Must be at least ${this.options.minLength} characters`;
      }

      // Max length check
      if (this.options.maxLength !== undefined && value.length > this.options.maxLength)
      {
        return `Must be at most ${this.options.maxLength} characters`;
      }

      // Custom validator
      if (this.options.validator)
      {
        return this.options.validator(value);
      }

      return undefined;
    };

    const { unmount, waitUntilExit } = render(
      <EditTextInput
        prompt={this.prompt}
        initialValue={this.options.initialValue}
        validate={validator}
        logger={ioContext.logger}
        onSubmit={(value) =>
        {
          this.log(io, `Submitted (${value.length} chars, ${value.split('\n').length} lines)`);
          resultValue = value;
          unmount();
        }}
        onCancel={
          this.options.cancelable
            ? () =>
            {
              this.log(io, 'Canceled');
              wasCanceled = true;
              unmount();
            }
            : undefined
        }
      />,
    );

    await waitUntilExit();

    // Handle the three possible outcomes
    if (wasCanceled)
    {
      return this.cancel();
    }

    if (resultValue === null)
    {
      return this.failWithUnknownError('No text provided');
    }

    return this.succeed(resultValue);
  }
}

if (import.meta.main)
{
  console.log('='.repeat(80));
  console.log('EditTextOp Examples');
  console.log('='.repeat(80));
  console.log();

  // Example 1: Simple text editing
  console.log('Example 1: Simple multiline text input\n');
  console.log('Try these features:');
  console.log('  - Type multiple lines of text (press Enter for new lines)');
  console.log('  - Use arrow keys to move cursor');
  console.log('  - Use Home/End to jump to start/end of line');
  console.log('  - Use Ctrl+Home/Ctrl+End to jump to start/end of document');
  console.log('  - Press Ctrl+S to save and submit');
  console.log('  - Press Escape to cancel\n');

  const op1 = new EditTextOp('Enter your message:', {
    cancelable: true,
    minLength: 10,
  });

  const result1 = await op1.run();

  if (result1.ok)
  {
    const text = result1.value;
    console.log('✅ Message received:');
    console.log('─'.repeat(80));
    console.log(text);
    console.log('─'.repeat(80));
    console.log(`Length: ${text.length} characters, ${text.split('\n').length} lines`);
  }
  else if (result1.failure === 'canceled')
  {
    console.log('🚫 Canceled');
  }
  else
  {
    console.log('❓ Unknown error:', result1.debugData);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Example 2: Editing existing content
  console.log('Example 2: Edit existing content\n');

  const existingContent = `Hello, world!

This is a multi-line text that you can edit.
Feel free to modify any part of it.

You can add new lines, delete text, or completely rewrite it.`;

  const op2 = new EditTextOp('Edit the text below:', {
    initialValue: existingContent,
    cancelable: true,
  });

  const result2 = await op2.run();

  if (result2.ok)
  {
    console.log('✅ Updated content:');
    console.log('─'.repeat(80));
    console.log(result2.value);
    console.log('─'.repeat(80));
  }
  else if (result2.failure === 'canceled')
  {
    console.log('🚫 Canceled');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Example 3: JSON validation
  console.log('Example 3: JSON editor with validation\n');
  console.log('Try entering valid JSON (the validator will check syntax):\n');

  const initialJson = `{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com"
}`;

  const op3 = new EditTextOp('Edit JSON:', {
    initialValue: initialJson,
    validator: (value) =>
    {
      try
      {
        JSON.parse(value);
        return undefined;
      }
      catch
      {
        return 'Invalid JSON syntax';
      }
    },
    cancelable: true,
  });

  const result3 = await op3.run();

  if (result3.ok)
  {
    console.log('✅ Valid JSON:');
    console.log('─'.repeat(80));
    console.log(result3.value);
    console.log('─'.repeat(80));

    // Pretty-print the JSON
    try
    {
      const parsed = JSON.parse(result3.value) as Record<string, unknown>;
      console.log('\nParsed object:', parsed);
    }
    catch
    {
      // Should not happen due to validation
    }
  }
  else if (result3.failure === 'canceled')
  {
    console.log('🚫 Canceled');
  }

  console.log('\n' + '='.repeat(80));
  console.log('All examples complete!');
  console.log('='.repeat(80));
}
