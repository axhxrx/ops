#!/usr/bin/env bun

import { parse, type ParseError, type ParseOptions } from 'jsonc-parser';
import { readFile } from 'node:fs/promises';
import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';
import type { Failure, Success } from './Outcome.ts';
import { readStdin } from './runtime-utils.ts';

/**
 Options for JSONCTC parsing
 */
export interface JSONCTCParseOptions
{
  /**
   Allow trailing commas in objects and arrays. Default: true
   */
  allowTrailingComma?: boolean;

  /**
   Allow JavaScript-style comments (//, /* *\/). Default: true
   */
  allowComments?: boolean;

  /**
   Disallow specific values like NaN or Infinity. Default: false
   */
  disallowComments?: boolean;
}

/**
 Parse JSONCTC (JSON with Comments and Trailing Commas) text into a JavaScript value

 This Op wraps Microsoft's jsonc-parser to provide 100% fidelity parsing of:
 - Standard JSON
 - Line comments (//)
 - Block comments (/* *\/)
 - Trailing commas in objects and arrays

 @example
 ```typescript
 const op = new JSONCTCParseOp(`{
   // User config
   "name": "Alice",
   "hobbies": [
     "reading",
     "coding",  // ← trailing comma OK!
   ],
 }`);
 const result = await op.run();
 if (result.ok) {
   console.log(result.value);  // { name: "Alice", hobbies: ["reading", "coding"] }
 }
 ```

 @example
 ```typescript
 // Parse from file
 import { readFile } from 'node:fs/promises';
 const json = await readFile('config.jsonctc', 'utf-8');
 const op = new JSONCTCParseOp(json);
 ```
 */
export class JSONCTCParseOp<T = unknown> extends Op
{
  name = 'JSONCTCParseOp';

  constructor(
    private text: string,
    private options?: JSONCTCParseOptions,
  )
  {
    super();
  }

  async run(_io?: IOContext): Promise<
    | Success<T>
    | Failure<'parseError'>
  >
  {
    await Promise.resolve();

    const errors: ParseError[] = [];

    const parseOptions: ParseOptions = {
      allowTrailingComma: this.options?.allowTrailingComma ?? true,
      disallowComments: this.options?.disallowComments ?? false,
    };

    try
    {
      const value = parse(this.text, errors, parseOptions) as T;

      if (errors.length > 0)
      {
        const errorMessages = errors.map(e => `Line ${e.offset}: ${this.formatError(e)}`).join('; ');
        return this.fail('parseError' as const, errorMessages);
      }

      return this.succeed(value);
    }
    catch (error: unknown)
    {
      return this.fail('parseError' as const, String(error));
    }
  }

  private formatError(error: ParseError): string
  {
    // ParseError has error code and message
    return `${error.error} at offset ${error.offset} length ${error.length}`;
  }
}

// CLI support
if (import.meta.main)
{
  const args = process.argv.slice(2);

  if (args.length < 1)
  {
    console.error('Usage: bun JSONCTCParseOp.ts <file-or-json>');
    console.error('');
    console.error('Examples:');
    console.error('  bun JSONCTCParseOp.ts config.jsonctc');
    console.error('  bun JSONCTCParseOp.ts \'{"key": "value",}\'  # trailing comma OK');
    console.error('  echo \'{ // comment\\n"key": "value" }\' | bun JSONCTCParseOp.ts -');
    process.exit(1);
  }

  let input: string;

  if (args[0] === '-')
  {
    // Read from stdin
    input = await readStdin();
  }
  else if (args[0]!.startsWith('{') || args[0]!.startsWith('['))
  {
    // Direct JSON string
    input = args[0]!;
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

  const op = new JSONCTCParseOp(input);
  const result = await op.run();

  if (result.ok)
  {
    console.log(JSON.stringify(result.value, null, 2));
  }
  else
  {
    console.error(`Parse error: ${result.failure}`);
    if (result.debugData)
    {
      console.error(result.debugData);
    }
    process.exit(1);
  }
}
