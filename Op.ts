import type { IOContext } from './IOContext';
import type { Failure, Success } from './Outcome.ts';

/**
 Abstract base class for ops.
 */
export abstract class Op
{
  abstract name: string;
  abstract run(io?: IOContext): Promise<Success<unknown> | Failure<unknown>>;

  /**
   Get IO context, defaulting to process streams if not provided
   */
  protected getIO(io?: IOContext): IOContext
  {
    return io ?? {
      stdin: process.stdin,
      stdout: process.stdout,
      mode: 'interactive',
    };
  }

  /**
   Helper to create a success outcome
   */
  succeed<T>(value: T): Success<T>
  {
    return { ok: true, value };
  }

  /**
   Helper to create a failure outcome. **Note:** don't forget to use `as const` to preserve literal type of `failure` or you will lose strong exhaustive typing of the possible failures. This helper is what makes the type inference work.

   Use 'as const' to preserve literal types!
   */
  fail<F>(failure: F, debugData?: string): Failure<F>
  {
    return { ok: false, failure, debugData };
  }

  /**
   The error of last resort
   */
  unknownError(debugData?: string): Failure<'unknownError'>
  {
    return { ok: false, failure: 'unknownError', debugData };
  }
}
