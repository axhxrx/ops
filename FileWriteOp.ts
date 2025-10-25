#!/usr/bin/env bun

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';
import type { Failure, Success } from './Outcome.ts';

/**
 * Generic file writer that accepts either a string OR an object with toString() method.
 *
 * This works seamlessly with JSONCTCObject (which has toString() that returns JSONCTC text
 * with comments preserved) and any other object that implements toString().
 *
 * Features:
 * - Atomic write pattern (write to temp file, then rename)
 * - Automatic parent directory creation
 * - Accepts string content OR object with toString()
 * - Proper error handling with typed failures
 *
 * @example
 * ```typescript
 * // Write string content
 * const op1 = new FileWriteOp('/tmp/test.txt', 'Hello, world!');
 * const result1 = await op1.run();
 *
 * // Write object with toString()
 * const obj = {
 *   data: { foo: 'bar' },
 *   toString() { return JSON.stringify(this.data, null, 2); }
 * };
 * const op2 = new FileWriteOp('/tmp/test.json', obj);
 * const result2 = await op2.run();
 *
 * // Works with JSONCTCObject
 * const jsonctc = new JSONCTCObject('{"foo": "bar"}');
 * const op3 = new FileWriteOp('/tmp/config.jsonctc', jsonctc);
 * const result3 = await op3.run();
 * ```
 */
export class FileWriteOp extends Op
{
  name = 'FileWriteOp';

  constructor(
    private filePath: string,
    private content: string | { toString(): string },
  )
  {
    super();
  }

  async run(_io?: IOContext): Promise<
    | Success<string> // Returns path that was written
    | Failure<'writeError' | 'accessDenied'>
  >
  {
    await Promise.resolve();

    // Get text content - either direct string or call toString()
    const textContent = typeof this.content === 'string'
      ? this.content
      : this.content.toString();

    // Ensure parent directory exists
    const dirPath = path.dirname(this.filePath);
    try
    {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    catch (error: unknown)
    {
      if (error && typeof error === 'object' && 'code' in error)
      {
        const code = (error as { code: string }).code;
        if (code === 'EACCES' || code === 'EPERM')
        {
          return this.fail('accessDenied' as const, `Cannot create directory: ${dirPath}`);
        }
      }
      return this.fail('writeError' as const, `Failed to create directory: ${String(error)}`);
    }

    // Atomic write: write to temp file, then rename
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;
    try
    {
      // Write to temp file
      fs.writeFileSync(tempPath, textContent, 'utf-8');

      // Atomic rename
      fs.renameSync(tempPath, this.filePath);

      return this.succeed(this.filePath);
    }
    catch (error: unknown)
    {
      // Clean up temp file if it exists
      try
      {
        if (fs.existsSync(tempPath))
        {
          fs.unlinkSync(tempPath);
        }
      }
      catch
      {
        // Ignore cleanup errors
      }

      // Classify the error
      if (error && typeof error === 'object' && 'code' in error)
      {
        const code = (error as { code: string }).code;
        if (code === 'EACCES' || code === 'EPERM')
        {
          return this.fail('accessDenied' as const, `Cannot write: ${this.filePath}`);
        }
      }
      return this.fail('writeError' as const, String(error));
    }
  }
}

// CLI support
if (import.meta.main)
{
  const args = process.argv.slice(2);

  if (args.length < 1)
  {
    console.error('Usage: bun FileWriteOp.ts <file> [content]');
    console.error('       echo "content" | bun FileWriteOp.ts <file> -');
    console.error('');
    console.error('Examples:');
    console.error('  bun FileWriteOp.ts output.txt "Hello, world!"');
    console.error('  echo "Hello from stdin" | bun FileWriteOp.ts output.txt -');
    process.exit(1);
  }

  const filePath = args[0]!;
  let content: string;

  // Check if content should come from stdin
  if (args.length === 1 || args[1] === '-')
  {
    // Read from stdin
    const stdinContent = await Bun.stdin.text();
    content = stdinContent;
  }
  else
  {
    // Use argument as content
    content = args.slice(1).join(' ');
  }

  const op = new FileWriteOp(filePath, content);
  const result = await op.run();

  if (result.ok)
  {
    console.log(`✓ Wrote to: ${result.value}`);
  }
  else
  {
    console.error(`✗ Error: ${result.failure}`);
    if (result.debugData)
    {
      console.error(result.debugData);
    }
    process.exit(1);
  }
}
