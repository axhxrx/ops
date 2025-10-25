#!/usr/bin/env bun

/**
 * Demo script for testing ConfirmOp with record/replay
 *
 * Usage:
 * - Interactive: bun ConfirmOp.demo.ts
 * - Record a session: bun ConfirmOp.demo.ts --record confirm-yes.json
 * - Replay a session: bun ConfirmOp.demo.ts --replay confirm-yes.json
 */

import { parseOpRunnerArgs } from './args.ts';
import { ConfirmOp } from './ConfirmOp.tsx';
import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';
import { OpRunner } from './OpRunner.ts';
import { PrintOp } from './PrintOp.ts';

/**
 * Demo op that chains Print -> Confirm -> Print result
 */
class ConfirmDemoOp extends Op
{
  name = 'ConfirmDemoOp';

  async run(_io?: IOContext)
  {
    await Promise.resolve(); // Ensure async behavior
    // Step 1: Print welcome message
    const welcomeOp = new WelcomeOp();
    return this.succeed(welcomeOp);
  }
}

/**
 * Print welcome, then move to confirm
 */
class WelcomeOp extends Op
{
  name = 'WelcomeOp';

  async run(io?: IOContext)
  {
    await Promise.resolve(); // Ensure async behavior
    const { stdout } = this.getIO(io);
    stdout.write('Welcome to ConfirmOp demo!\n\n');

    // Move to confirm step
    const confirmOp = new AskConfirmOp();
    return this.succeed(confirmOp);
  }
}

/**
 * Ask for confirmation, then move to result
 */
class AskConfirmOp extends Op
{
  name = 'AskConfirmOp';

  async run(io?: IOContext)
  {
    const confirmOp = new ConfirmOp('Do you want to continue?', {
      cancelable: true,
      defaultValue: false,
    });

    const outcome = await confirmOp.run(io);

    if (!outcome.ok)
    {
      // Canceled!
      const cancelOp = new PrintOp('\n🚫 Operation canceled.\n');
      return this.succeed(cancelOp);
    }

    // Confirmed or declined
    const resultOp = new PrintOp(
      outcome.value
        ? '\n✅ You confirmed! Continuing...\n'
        : '\n❌ You declined. Stopping.\n',
    );

    return this.succeed(resultOp);
  }
}

if (import.meta.main)
{
  const { opRunner } = parseOpRunnerArgs(process.argv.slice(2));
  const demoOp = new ConfirmDemoOp();
  const runner = await OpRunner.create(demoOp, opRunner);
  await runner.run();
}
