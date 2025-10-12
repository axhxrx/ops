import type { OpRunnerArgs } from './args';
import { createIOContext, type IOContext } from './IOContext';
import type { Op } from './Op';

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
  private stack: Op[] = [];
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
  static async create(initialOp: Op, ioConfig: OpRunnerArgs): Promise<OpRunner>
  {
    const io = await createIOContext(ioConfig);
    return new OpRunner(initialOp, ioConfig, io);
  }

  /**
   Run the op stack until empty

   Stack execution rules:
   1. Run the top op on the stack
   2. If it succeeds and returns another op, push that op
   3. If it succeeds with any other value, pop current op
   4. If it fails, pop current op
   5. Repeat until stack is empty
   */
  async run(): Promise<void>
  {
    console.log('[OpRunner] 🚀 Starting execution');
    console.log(`[OpRunner] Mode: ${this.io.mode}`);
    console.log('');

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

      console.log(`[OpRunner] ▶️  Running: ${op.name}`);
      console.log(`[OpRunner] 📚 Stack depth: ${this.stack.length}`);
      console.log(`[OpRunner] 📋 Stack: [${this.stack.map(o => o.name).join(' → ')}]`);
      console.log('');

      const opStartTime = Date.now();
      const outcome = await op.run(this.io);
      const opDuration = Date.now() - opStartTime;

      if (!outcome.ok)
      {
        console.log(`[OpRunner] ❌ Failed: ${op.name} (${opDuration}ms)`);
        console.log(`[OpRunner]    Failure: ${String(outcome.failure)}`);
        if (outcome.debugData)
        {
          console.log(`[OpRunner]    Debug: ${outcome.debugData}`);
        }
        console.log(`[OpRunner] ⬇️  Popping: ${op.name}`);
        this.stack.pop();
        console.log('');
        continue;
      }

      // Success!
      console.log(`[OpRunner] ✅ Completed: ${op.name} (${opDuration}ms)`);

      // Check if the success value is another op
      const isNextOp = outcome.value
        && typeof outcome.value === 'object'
        && 'run' in outcome.value
        && 'name' in outcome.value;

      if (isNextOp)
      {
        const nextOp = outcome.value as Op;
        console.log(`[OpRunner] 🔄 Replacing: ${op.name} → ${nextOp.name}`);
        // Replace current op with next op (don't push on top!)
        this.stack[this.stack.length - 1] = nextOp;
      }
      else
      {
        console.log(`[OpRunner] ⬇️  Popping: ${op.name}`);
        if (outcome.value !== undefined && outcome.value !== null)
        {
          console.log(`[OpRunner]    Value: ${JSON.stringify(outcome.value)}`);
        }
        this.stack.pop();
      }

      console.log('');
    }

    const totalDuration = Date.now() - this.startTime;
    console.log('[OpRunner] 🏁 Stack empty, execution complete!');
    console.log(`[OpRunner] ⏱️  Total time: ${totalDuration}ms`);
    console.log('');

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
