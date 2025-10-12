import type { IOContext } from './IOContext';
import { createDefaultLogger } from './Logger';
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
      logger: createDefaultLogger(),
    };
  }

  /**
   * Convenience method for logging from ops
   * Uses the logger from IOContext, which respects the logging configuration
   *
   * @example
   * ```typescript
   * class MyOp extends Op {
   *   async run(io?: IOContext) {
   *     this.log(io, 'Starting operation...');
   *     // ... do work ...
   *     this.log(io, 'Operation complete');
   *     return this.succeed(result);
   *   }
   * }
   * ```
   */
  protected log(io: IOContext | undefined, message: string): void
  {
    this.getIO(io).logger.log(message);
  }

  /**
   * Convenience method for warning from ops
   */
  protected warn(io: IOContext | undefined, message: string): void
  {
    this.getIO(io).logger.warn(message);
  }

  /**
   * Convenience method for errors from ops
   */
  protected error(io: IOContext | undefined, message: string): void
  {
    this.getIO(io).logger.error(message);
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
  failWithUnknownError(debugData?: string): Failure<'unknownError'>
  {
    return { ok: false, failure: 'unknownError', debugData };
  }

  /**
   Standard cancellation helper - use when user explicitly cancels an operation. That's just a somewhat special case of failure.

   Not all ops should be cancelable; it should be configurable.

   Common cancellation triggers:
   - User presses Escape key in interactive components (opt-in via `cancelable` option)
   - User sends interrupt signal (Ctrl+C is handled by framework)
   - Operation times out (if implementing timeout logic)
   */
  cancel(): Failure<'canceled'>
  {
    return { ok: false, failure: 'canceled' };
  }
}
