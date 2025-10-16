import type { OpRunnerArgs } from './args';
import { createIOContext, type IOContext } from './IOContext';
import type { Op } from './Op';
import type { OpWithHandler, OutcomeHandler } from './Outcome';

/**
 Stack-based operation runner with full observability

 Benefits:
 - Centralized observability: ONE place where all op transitions happen
 - Log every op that runs, time every op, see full stack at any point
 - Separation of concerns: Ops describe intent, don't control execution
 - Easy to add hooks/middleware later (before/after, metrics, tracing, etc.)
 - Testing: Easier to test ops in isolation
 */
export class OpRunner
{
  /**
   Enable or disable OpRunner's internal logging. Default: false
   */
  static opLoggingEnabled = false;

  private stack: Op[] = [];
  private parentStack: Array<{ parent: Op; handler: OutcomeHandler<Op> }> = []; // Parallel stack for ops with outcome handlers
  private io: IOContext;
  private ioConfig: OpRunnerArgs;
  private startTime: number;

  private constructor(
    initialOp: Op,
    ioConfig: OpRunnerArgs,
    io: IOContext,
  )
  {
    this.stack = [initialOp];
    this.ioConfig = ioConfig;
    this.io = io;
    this.startTime = Date.now();
  }

  /**
   * Create an OpRunner instance (async because IO setup may be async)
   */
  static async create(initialOp: Op, ioConfig: OpRunnerArgs = {mode: "interactive"}): Promise<OpRunner>
  {
    const io = await createIOContext(ioConfig);
    return new OpRunner(initialOp, ioConfig, io);
  }

  /**
   Run the op stack until empty

   Stack execution rules:
   1. Run the top op on the stack
   2. If it succeeds and returns OpWithHandler:
      - PUSH child op (keep parent on stack)
      - Store parent + handler in parentStack
   3. If it succeeds and returns plain Op:
      - REPLACE current with child
   4. If it succeeds with non-Op value:
      - Pop current op
   5. After child completes (success OR failure):
      - If parent has handler: call handler(outcome)
      - If handler returns true: re-run parent
      - If handler returns false: pop both parent and child
      - If handler returns Op: replace child with new op
   6. Repeat until stack is empty
   */
  async run(): Promise<void>
  {
    if (OpRunner.opLoggingEnabled)
    {
      console.log('[OpRunner] 🚀 Starting execution');
      console.log(`[OpRunner] Mode: ${this.io.mode}`);
      console.log('');
    }

    // Start replay if in replay mode
    // Use a longer delay to ensure Ink has time to mount and attach listeners
    if (this.ioConfig.mode === 'replay' && this.io.replayableStdin)
    {
      this.io.replayableStdin.startReplay(500); // 500ms delay
    }

    while (this.stack.length > 0)
    {
      const op = this.stack[this.stack.length - 1];
      if (!op)
      {
        // Should never happen, but TypeScript wants us to check
        throw new Error('[OpRunner] Internal error: op is undefined');
      }

      if (OpRunner.opLoggingEnabled)
      {
        console.log(`[OpRunner] ▶️  Running: ${op.name}`);
        console.log(`[OpRunner] 📚 Stack depth: ${this.stack.length}`);
        console.log(`[OpRunner] 📋 Stack: [${this.stack.map(o => o.name).join(' → ')}]`);
        console.log('');
      }

      const opStartTime = Date.now();
      const outcome = await op.run(this.io);
      const opDuration = Date.now() - opStartTime;

      // Log outcome
      if (OpRunner.opLoggingEnabled)
      {
        if (outcome.ok)
        {
          console.log(`[OpRunner] ✅ Completed: ${op.name} (${opDuration}ms)`);
        }
        else
        {
          console.log(`[OpRunner] ❌ Failed: ${op.name} (${opDuration}ms)`);
          console.log(`[OpRunner]    Failure: ${String(outcome.failure)}`);
          if (outcome.debugData)
          {
            console.log(`[OpRunner]    Debug: ${outcome.debugData}`);
          }
        }
      }

      // Check if there's a parent with outcome handler
      const parentInfo = this.parentStack[this.parentStack.length - 1];
      if (parentInfo)
      {
        // Call handler with child's outcome (success or failure)
        const handlerResult = parentInfo.handler(outcome);

        if (handlerResult === true)
        {
          // Handler says: re-run parent
          if (OpRunner.opLoggingEnabled)
          {
            console.log(
              `[OpRunner] 🔄 Handler says re-run parent: ${parentInfo.parent.name}`,
            );
          }
          this.stack.pop(); // pop child
          this.parentStack.pop(); // pop parent info
          // parent stays on stack, will be re-run
          if (OpRunner.opLoggingEnabled) console.log('');
          continue;
        }
        else if (handlerResult === false)
        {
          // Handler says: pop both parent and child (normal completion)
          if (OpRunner.opLoggingEnabled)
          {
            console.log(`[OpRunner] ⬇️  Handler says pop both child and parent`);
          }
          this.stack.pop(); // pop child
          this.parentStack.pop(); // pop parent info
          this.stack.pop(); // pop parent
          if (OpRunner.opLoggingEnabled) console.log('');
          continue;
        }
        else if (typeof handlerResult === 'object' && 'run' in handlerResult)
        {
          // Handler returned a different op: replace child, keep parent waiting
          if (OpRunner.opLoggingEnabled)
          {
            console.log(
              `[OpRunner] 🔄 Handler says replace child with: ${handlerResult.name}`,
            );
          }
          this.stack[this.stack.length - 1] = handlerResult;
          // parent info stays in parentStack, will handle next child's outcome
          if (OpRunner.opLoggingEnabled) console.log('');
          continue;
        }
        else
        {
          // Unknown handler return value, treat as false (pop both)
          if (OpRunner.opLoggingEnabled)
          {
            console.log(
              `[OpRunner] ⚠️  Handler returned unknown value, treating as false (pop both)`,
            );
          }
          this.stack.pop(); // pop child
          this.parentStack.pop(); // pop parent info
          this.stack.pop(); // pop parent
          if (OpRunner.opLoggingEnabled) console.log('');
          continue;
        }
      }

      // No handler, use normal logic
      if (!outcome.ok)
      {
        // Normal failure: just pop the failed op
        if (OpRunner.opLoggingEnabled)
        {
          console.log(`[OpRunner] ⬇️  Popping: ${op.name}`);
          console.log('');
        }
        this.stack.pop();
        continue;
      }

      // Success with no handler

      // Check if the success value is OpWithHandler (wrapped op)
      const isWrappedOp = outcome.value
        && typeof outcome.value === 'object'
        && 'op' in outcome.value
        && 'handler' in outcome.value;

      if (isWrappedOp)
      {
        // PUSH mode: Keep parent, push child, track handler
        const wrapped = outcome.value as OpWithHandler<Op>;
        if (OpRunner.opLoggingEnabled)
        {
          console.log(
            `[OpRunner] 📌 Pushing: ${wrapped.op.name} (parent has outcome handler)`,
          );
        }
        this.parentStack.push({ parent: op, handler: wrapped.handler });
        this.stack.push(wrapped.op);
      }
      else
      {
        // Check if it's a plain Op
        const isNextOp = outcome.value
          && typeof outcome.value === 'object'
          && 'run' in outcome.value
          && 'name' in outcome.value;

        if (isNextOp)
        {
          // REPLACE mode: Replace current with child
          const nextOp = outcome.value as Op;
          if (OpRunner.opLoggingEnabled)
          {
            console.log(`[OpRunner] 🔄 Replacing: ${op.name} → ${nextOp.name}`);
          }
          this.stack[this.stack.length - 1] = nextOp;
        }
        else
        {
          // Not an op, just pop
          if (OpRunner.opLoggingEnabled)
          {
            console.log(`[OpRunner] ⬇️  Popping: ${op.name}`);
            if (outcome.value !== undefined && outcome.value !== null)
            {
              console.log(`[OpRunner]    Value: ${JSON.stringify(outcome.value)}`);
            }
          }
          this.stack.pop();
        }
      }

      if (OpRunner.opLoggingEnabled) console.log('');
    }

    const totalDuration = Date.now() - this.startTime;
    if (OpRunner.opLoggingEnabled)
    {
      console.log('[OpRunner] 🏁 Stack empty, execution complete!');
      console.log(`[OpRunner] ⏱️  Total time: ${totalDuration}ms`);
      console.log('');
    }

    // Save recorded session if in record mode
    if (this.ioConfig.mode === 'record' && this.io.recordableStdin && this.ioConfig.sessionFile)
    {
      await this.io.recordableStdin.saveSession(this.ioConfig.sessionFile);
    }
  }

  /**
   Get current stack depth (useful for debugging)
   */
  getStackDepth(): number
  {
    return this.stack.length;
  }

  /**
   Get current stack snapshot (useful for debugging)
   */
  getStackSnapshot(): string[]
  {
    return this.stack.map(op => op.name);
  }
}
