#!/usr/bin/env bun

import type { IOContext } from './IOContext';
import { Op } from './Op';

/**
 PrintOp - Prints a message to stdout

 This op respects the IOContext, so output will be captured in logs/replays.

 Features:
 - Optional prohibited words validation
 - Optional message length validation
 - Uses io.stdout.write() to respect TeeStream and other IO redirections

 Example:
 ```ts
 const op = new PrintOp('Hello, world!');
 await op.run(ioContext);
 ```
 */
export class PrintOp extends Op
{
  constructor(
    private message: string,
    private prohibitedWords?: string[],
  )
  {
    super();
  }

  get name(): string
  {
    return `PrintOp`;
  }

  async run(io?: IOContext)
  {
    const { stdout } = this.getIO(io);

    await Promise.resolve();
    try
    {
      // Check for prohibited words
      if (this.prohibitedWords?.some((word) => this.message.includes(word)))
      {
        // The 'as const' is CRITICAL - it preserves the literal type 'ProhibitedWord'
        return this.fail('ProhibitedWord' as const, `Message: ${this.message}`);
      }

      // Check message length
      if (this.message.length > 100)
      {
        // Another literal type preserved with 'as const'
        return this.fail('MessageTooLong' as const, `Length: ${this.message.length}`);
      }

      // Success path - write to stdout (respects TeeStream!)
      stdout.write(this.message);
      return this.succeed(this.message);
    }
    catch (error)
    {
      // Catch-all for unexpected errors
      return this.failWithUnknownError(String(error));
    }
  }
}

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
