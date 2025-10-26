#!/usr/bin/env bun

import { readFile } from 'node:fs/promises';
import { applyEdits, format, type FormattingOptions } from 'jsonc-parser';
import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';
import type { Failure, Success } from './Outcome.ts';
import { readStdin } from './runtime-utils.ts';

/**
 Options for JSONCTC formatting
 */
export interface JSONCTCFormatOptions
{
  /**
   Number of spaces for indentation. Default: 2
   */
  tabSize?: number;

  /**
   Use spaces instead of tabs. Default: true
   */
  insertSpaces?: boolean;

  /**
   Insert a newline at the end of the file. Default: true
   */
  insertFinalNewline?: boolean;

  /**
   Line ending style. Default: '\n'
   */
  eol?: '\n' | '\r\n';

  /**
   Keep or remove existing lines. Default: true (keep)
   */
  keepLines?: boolean;
}

/**
 Format JSONCTC text while preserving comments and trailing commas

 This Op wraps Microsoft's jsonc-parser format() function to provide 100% fidelity formatting that preserves:
 - Line comments (//)
 - Block comments (/* *\/)
 - Trailing commas in objects and arrays

 The formatter will:
 - Normalize indentation
 - Add/remove whitespace
 - Preserve all comments in their original positions
 - Preserve trailing commas

 @example
 ```typescript
 const messyJson = `{  "name":"Alice",// comment
 "age":  30,  }`;

 const op = new JSONCTCFormatOp(messyJson);
 const result = await op.run();
 if (result.ok) {
   console.log(result.value);
   // {
   //   "name": "Alice", // comment
   //   "age": 30,
   // }
 }
 ```

 @example
 ```typescript
 // Format with custom options
 const op = new JSONCTCFormatOp(json, {
   tabSize: 4,
   insertSpaces: true,
   eol: '\r\n'
 });
 ```
 */
export class JSONCTCFormatOp extends Op
{
  name = 'JSONCTCFormatOp';

  constructor(
    private text: string,
    private options?: JSONCTCFormatOptions,
  )
  {
    super();
  }

  async run(_io?: IOContext): Promise<
    | Success<string>
    | Failure<'formatError'>
  >
  {
    await Promise.resolve();

    try
    {
      const formattingOptions: FormattingOptions = {
        tabSize: this.options?.tabSize ?? 2,
        insertSpaces: this.options?.insertSpaces ?? true,
        insertFinalNewline: this.options?.insertFinalNewline ?? true,
        eol: this.options?.eol ?? '\n',
        keepLines: this.options?.keepLines ?? true,
      };

      // format() returns an array of edits
      const edits = format(this.text, undefined, formattingOptions);

      // Apply edits to get formatted text
      const formatted = applyEdits(this.text, edits);

      return this.succeed(formatted);
    }
    catch (error: unknown)
    {
      return this.fail('formatError' as const, String(error));
    }
  }
}

// CLI support
if (import.meta.main)
{
  const args = process.argv.slice(2);

  if (args.length < 1)
  {
    console.error('Usage: bun JSONCTCFormatOp.ts <file>');
    console.error('');
    console.error('Examples:');
    console.error('  bun JSONCTCFormatOp.ts config.jsonctc');
    console.error('  echo \'{ // comment\\n"key":"value", }\' | bun JSONCTCFormatOp.ts -');
    console.error('');
    console.error('The formatter preserves:');
    console.error('  - Comments (//, /* */)');
    console.error('  - Trailing commas');
    console.error('  - Comment positions');
    process.exit(1);
  }

  let input: string;

  if (args[0] === '-')
  {
    // Read from stdin
    input = await readStdin();
  }
  else
  {
    // Read from file
    try
    {
      input = await readFile(args[0]!, 'utf-8');
    }
    catch (error: unknown)
    {
      console.error(`Error reading file: ${String(error)}`);
      process.exit(1);
    }
  }

  const op = new JSONCTCFormatOp(input);
  const result = await op.run();

  if (result.ok)
  {
    console.log(result.value);
  }
  else
  {
    console.error(`Format error: ${result.failure}`);
    if (result.debugData)
    {
      console.error(result.debugData);
    }
    process.exit(1);
  }
}
