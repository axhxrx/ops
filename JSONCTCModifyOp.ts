#!/usr/bin/env bun

import { applyEdits, modify, type FormattingOptions, type ModificationOptions } from 'jsonc-parser';
import type { IOContext } from './IOContext';
import { Op } from './Op';
import type { Failure, Success } from './Outcome';

/**
 Options for JSONCTC modification
 */
export interface JSONCTCModifyOptions
{
  /**
   Formatting options for the modification
   */
  formatting?: {
    tabSize?: number;
    insertSpaces?: boolean;
    insertFinalNewline?: boolean;
    eol?: '\n' | '\r\n';
  };

  /**
   Whether to get formatted edit operations. Default: true
   */
  isArrayInsertion?: boolean;

  /**
   Array insertion index. Default: -1 (append)
   */
  getInsertionIndex?: () => number;
}

/**
 Modify a value in JSONCTC text while preserving comments and trailing commas

 This Op wraps Microsoft's jsonc-parser modify() function to provide smart value updates that preserve:
 - Line comments (//)
 - Block comments (/* *\/)
 - Trailing commas in objects and arrays
 - Original formatting and indentation

 The modifier will:
 - Update the specified value at the given path
 - Preserve all comments
 - Preserve trailing commas
 - Match existing indentation style
 - Add trailing commas to new array items (if original had them)

 @example
 ```typescript
 const json = `{
   // User config
   "name": "Alice",
   "age": 30,
 }`;

 const op = new JSONCTCModifyOp(json, ['name'], 'Bob');
 const result = await op.run();
 if (result.ok) {
   console.log(result.value);
   // {
   //   // User config  ← comment preserved!
   //   "name": "Bob",
   //   "age": 30,     ← trailing comma preserved!
   // }
 }
 ```

 @example
 ```typescript
 // Add new property
 const op = new JSONCTCModifyOp(json, ['email'], 'alice@example.com');

 // Modify nested value
 const op = new JSONCTCModifyOp(json, ['address', 'city'], 'Paris');

 // Modify array element
 const op = new JSONCTCModifyOp(json, ['hobbies', 0], 'swimming');
 ```
 */
export class JSONCTCModifyOp extends Op
{
  name = 'JSONCTCModifyOp';

  constructor(
    private text: string,
    private path: (string | number)[],
    private value: unknown,
    private options?: JSONCTCModifyOptions,
  )
  {
    super();
  }

  async run(_io?: IOContext): Promise<
    | Success<string>
    | Failure<'modifyError'>
  >
  {
    await Promise.resolve();

    try
    {
      const formattingOptions: FormattingOptions = {
        tabSize: this.options?.formatting?.tabSize ?? 2,
        insertSpaces: this.options?.formatting?.insertSpaces ?? true,
        insertFinalNewline: this.options?.formatting?.insertFinalNewline ?? true,
        eol: this.options?.formatting?.eol ?? '\n',
      };

      const modificationOptions: ModificationOptions = {
        formattingOptions,
        isArrayInsertion: this.options?.isArrayInsertion,
        getInsertionIndex: this.options?.getInsertionIndex,
      };

      // modify() returns an array of edits
      const edits = modify(
        this.text,
        this.path,
        this.value,
        modificationOptions,
      );

      // Apply edits to get modified text
      const modified = applyEdits(this.text, edits);

      return this.succeed(modified);
    }
    catch (error: unknown)
    {
      return this.fail('modifyError' as const, String(error));
    }
  }
}

// CLI support
if (import.meta.main)
{
  const args = Bun.argv.slice(2);

  if (args.length < 3)
  {
    console.error('Usage: bun JSONCTCModifyOp.ts <file> <path> <value>');
    console.error('');
    console.error('Examples:');
    console.error('  bun JSONCTCModifyOp.ts config.jsonctc name Bob');
    console.error('  bun JSONCTCModifyOp.ts config.jsonctc address.city Paris');
    console.error('  bun JSONCTCModifyOp.ts config.jsonctc hobbies.0 swimming');
    console.error('  bun JSONCTCModifyOp.ts config.jsonctc age 42');
    console.error('');
    console.error('The modifier preserves:');
    console.error('  - Comments (//, /* */)');
    console.error('  - Trailing commas');
    console.error('  - Original formatting');
    process.exit(1);
  }

  const filename = args[0]!;
  const pathStr = args[1]!;
  const valueStr = args[2]!;

  // Read file
  let input: string;
  try
  {
    input = await Bun.file(filename).text();
  }
  catch (error: unknown)
  {
    console.error(`Error reading file: ${String(error)}`);
    process.exit(1);
  }

  // Parse path (support dot notation and array indices)
  const path = pathStr.split('.').map(part =>
  {
    const num = Number(part);
    return isNaN(num) ? part : num;
  });

  // Try to parse value as JSON, fall back to string
  let value: unknown;
  try
  {
    value = JSON.parse(valueStr);
  }
  catch
  {
    value = valueStr;
  }

  const op = new JSONCTCModifyOp(input, path, value);
  const result = await op.run();

  if (result.ok)
  {
    console.log(result.value);
  }
  else
  {
    console.error(`Modify error: ${result.failure}`);
    if (result.debugData)
    {
      console.error(result.debugData);
    }
    process.exit(1);
  }
}
