import type { IOContext } from './IOContext';
import { createDefaultLogger } from './Logger';
import type { Failure, OpWithHandler, OutcomeHandler, Success } from './Outcome.ts';

/**
 Abstract base class for ops.
 */
export abstract class Op
{
  /**
   The `static` variant of `run()` creates an instance of the op and runs it.

   This type-fu avoids the `Cannot create an instance of an abstract class` error.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static async run<ThisT extends new(...args: any[]) => Op>(
    this: ThisT,
    ...args: ConstructorParameters<ThisT>
  )
  {
    const op = new this(...args);
    return await op.run() as ReturnType<InstanceType<ThisT>['run']>;
  }

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

   @param value - The success value
   */
  succeed<T>(value: T): Success<T>
  {
    return { ok: true, value };
  }

  /**
   Helper to wrap a child Op with an outcome handler

   The handler receives the child's outcome and returns:
   - true: Re-run the parent Op
   - false: Normal completion (pop both parent and child)
   - Op: Replace child with the returned Op (keep parent waiting)

   This enables flexible control flow without circular dependencies. The parent can inspect both success and failure outcomes of the child and decide what to do next.

   @param op - The child Op to run
   @param handler - Function that receives child's outcome and decides what to do

   @example
   ```typescript
   // Re-run parent when child is canceled
   return this.handleOutcome(
     new FileOperationsMenuOp(),
     (outcome) => !outcome.ok && outcome.failure === 'canceled'
   );

   // Re-run parent on any failure
   return this.handleOutcome(
     new SomeOp(),
     (outcome) => !outcome.ok
   );

   // Re-run parent on success
   return this.handleOutcome(
     new ConfirmOp('Try again?'),
     (outcome) => outcome.ok && outcome.value === true
   );

   // Route to different ops based on outcome
   return this.handleOutcome(
     new SelectFromListOp(['A', 'B', 'Back']),
     (outcome) => {
       if (!outcome.ok) return true; // re-run on cancel
       if (outcome.value === 'Back') return true;
       if (outcome.value === 'A') return new OpA();
       return new OpB();
     }
   );
   ```
   */
  protected handleOutcome<OpT extends Op>(
    op: OpT,
    handler: OutcomeHandler<OpT> = (_outcome) => true,
  ): Success<OpWithHandler<OpT>>
  {
    return this.succeed({ op, handler });
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
