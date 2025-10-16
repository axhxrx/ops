#!/usr/bin/env bun

import * as fs from 'node:fs';
import process from 'node:process';
import type { IOContext } from './IOContext';
import { JSONCTCObject } from './JSONCTCObject';
import { Op } from './Op';
import type { Failure, Success } from './Outcome';

/**
 * Read a JSONCTC file and return a JSONCTCObject wrapper
 *
 * This Op reads a JSONCTC file from disk and wraps it in a JSONCTCObject,
 * which provides a Proxy-based interface for tracking changes while preserving
 * comments and formatting.
 *
 * @example
 * ```typescript
 * const op = new JSONCTCReadFileOp('/path/to/config.jsonctc');
 * const result = await op.run();
 *
 * if (result.ok) {
 *   const obj = result.value;
 *   obj.data.name = "Bob";  // Modify data
 *   console.log(obj.toString());  // Serialize with comments preserved
 * }
 * ```
 *
 * @example
 * ```bash
 * # CLI usage
 * bun JSONCTCReadFileOp.ts config.jsonctc
 * ```
 */
export class JSONCTCReadFileOp extends Op
{
  name = 'JSONCTCReadFileOp';

  constructor(private filePath: string)
  {
    super();
  }

  async run(_io?: IOContext): Promise<
    | Success<JSONCTCObject>
    | Failure<'fileNotFound' | 'readError' | 'parseError'>
  >
  {
    await Promise.resolve();

    try
    {
      // Read file synchronously
      const content = fs.readFileSync(this.filePath, 'utf-8');

      // Create JSONCTCObject from the content
      try
      {
        const obj = new JSONCTCObject(content);
        return this.succeed(obj);
      }
      catch (parseError: unknown)
      {
        return this.fail('parseError' as const, `Failed to parse JSONCTC: ${String(parseError)}`);
      }
    }
    catch (error: unknown)
    {
      // Check if file not found
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      {
        return this.fail('fileNotFound' as const, `File not found: ${this.filePath}`);
      }

      // Other read errors
      return this.fail('readError' as const, `Failed to read file: ${String(error)}`);
    }
  }
}

// CLI support
if (import.meta.main)
{
  const args = Bun.argv.slice(2);

  if (args.length < 1)
  {
    console.error('Usage: bun JSONCTCReadFileOp.ts <file>');
    console.error('');
    console.error('Examples:');
    console.error('  bun JSONCTCReadFileOp.ts config.jsonctc');
    console.error('  bun JSONCTCReadFileOp.ts /path/to/data.json');
    process.exit(1);
  }

  const filePath = args[0]!;
  const op = new JSONCTCReadFileOp(filePath);
  const result = await op.run();

  if (result.ok)
  {
    const obj = result.value;
    console.log(JSON.stringify(obj.data, null, 2));
  }
  else
  {
    console.error(`Error: ${result.failure}`);
    if (result.debugData)
    {
      console.error(result.debugData);
    }
    process.exit(1);
  }
}
