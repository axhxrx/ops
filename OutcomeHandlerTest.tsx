#!/usr/bin/env bun

/**
 OutcomeHandlerTest - Tests for the outcome handler functionality

 This test demonstrates all the ways outcome handlers can be used:
 1. Re-run parent on cancel (specific failure)
 2. Re-run parent on any failure
 3. Re-run parent on success
 4. Replace child with different op based on outcome

 Note: Handlers must always return an Op (usually `this` to re-run parent).

 Run with: bun OutcomeHandlerTest.tsx
 */

import { parseOpRunnerArgs } from './args.ts';
import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';
import { OpRunner } from './OpRunner.ts';

// Enable logging to see the flow
// OpRunner.opLoggingEnabled = true; // TODO: Update OpRunner logging API

/**
 Test 1: Re-run parent on cancel
 */
class MenuOp extends Op
{
  name = 'MenuOp';
  runCount = 0;

  async run(io?: IOContext)
  {
    await Promise.resolve();
    this.runCount++;
    const { stdout } = this.getIO(io);
    stdout.write(`\n[MenuOp] Running (attempt #${this.runCount})\n`);

    if (this.runCount === 1)
    {
      // First run: delegate to child that will cancel
      stdout.write('[MenuOp] Delegating to CancelableOp (will cancel)\n');
      return this.handleOutcome(
        new CancelableOp(true), // will cancel
        (_outcome) => this, // Re-run parent regardless of outcome
      );
    }
    else if (this.runCount === 2)
    {
      // Second run (after child canceled): delegate to child that will succeed
      stdout.write('[MenuOp] Delegating to CancelableOp (will succeed)\n');
      return this.handleOutcome(
        new CancelableOp(false), // will succeed
        (_outcome) => this, // Re-run parent regardless of outcome
      );
    }
    else
    {
      // Third run or later: we're done
      stdout.write('[MenuOp] All attempts complete!\n');
      return this.succeed(undefined);
    }
  }
}

class CancelableOp extends Op
{
  name = 'CancelableOp';

  constructor(private shouldCancel: boolean)
  {
    super();
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();
    const { stdout } = this.getIO(io);
    if (this.shouldCancel)
    {
      stdout.write('[CancelableOp] Canceling...\n');
      return this.cancel();
    }
    stdout.write('[CancelableOp] Succeeding!\n');
    return this.succeed('success');
  }
}

/**
 Test 2: Re-run on any failure
 */
class RetryOnAnyFailureOp extends Op
{
  name = 'RetryOnAnyFailureOp';
  attempts = 0;

  async run(io?: IOContext)
  {
    await Promise.resolve();
    this.attempts++;
    const { stdout } = this.getIO(io);
    stdout.write(`\n[RetryOnAnyFailureOp] Attempt #${this.attempts}\n`);

    if (this.attempts === 1)
    {
      return this.handleOutcome(
        new FailingOp('networkError'),
        (_outcome) => this, // Always re-run parent
      );
    }
    else if (this.attempts === 2)
    {
      return this.handleOutcome(
        new FailingOp('timeout'),
        (_outcome) => this, // Always re-run parent
      );
    }
    else
    {
      stdout.write('[RetryOnAnyFailureOp] Finally giving up!\n');
      return this.succeed(undefined);
    }
  }
}

class FailingOp extends Op
{
  name = 'FailingOp';

  constructor(private failureType: string)
  {
    super();
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();
    const { stdout } = this.getIO(io);
    stdout.write(`[FailingOp] Failing with: ${this.failureType}\n`);
    return this.fail(this.failureType);
  }
}

/**
 Test 3: Re-run on success
 */
class RetryOnSuccessOp extends Op
{
  name = 'RetryOnSuccessOp';
  attempts = 0;

  async run(io?: IOContext)
  {
    await Promise.resolve();
    this.attempts++;
    const { stdout } = this.getIO(io);
    stdout.write(`\n[RetryOnSuccessOp] Attempt #${this.attempts}\n`);

    if (this.attempts < 3)
    {
      return this.handleOutcome(
        new SucceedingOp(`result-${this.attempts}`),
        (_outcome) => this, // Always re-run parent
      );
    }
    else
    {
      stdout.write('[RetryOnSuccessOp] Done retrying on success!\n');
      return this.succeed(undefined);
    }
  }
}

class SucceedingOp extends Op
{
  name = 'SucceedingOp';

  constructor(private value: string)
  {
    super();
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();
    const { stdout } = this.getIO(io);
    stdout.write(`[SucceedingOp] Succeeding with: ${this.value}\n`);
    return this.succeed(this.value);
  }
}

/**
 Test 4: Route to different ops based on outcome
 */
class RouterOp extends Op
{
  name = 'RouterOp';
  attempt = 0;

  async run(io?: IOContext)
  {
    await Promise.resolve();
    this.attempt++;
    const { stdout } = this.getIO(io);
    stdout.write(`\n[RouterOp] Routing (attempt #${this.attempt})\n`);

    if (this.attempt === 1)
    {
      return this.handleOutcome(
        new ChoiceOp('A'),
        (outcome) =>
        {
          if (!outcome.ok) return this; // re-run on failure
          if (outcome.value === 'A') return new ChoiceOp('B'); // route to B
          if (outcome.value === 'B') return new ChoiceOp('C'); // route to C
          return this; // re-run parent to complete
        },
      );
    }
    else if (this.attempt === 2)
    {
      // After child returned B, router runs again, routes to C
      return this.handleOutcome(
        new ChoiceOp('C'),
        (outcome) =>
        {
          if (!outcome.ok) return this;
          if (outcome.value === 'C') return this; // re-run parent to complete
          return this;
        },
      );
    }
    else
    {
      stdout.write('[RouterOp] All routing complete!\n');
      return this.succeed(undefined);
    }
  }
}

class ChoiceOp extends Op
{
  name = 'ChoiceOp';

  constructor(private choice: string)
  {
    super();
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();
    const { stdout } = this.getIO(io);
    stdout.write(`[ChoiceOp] Returning choice: ${this.choice}\n`);
    return this.succeed(this.choice);
  }
}

/**
 Main test runner
 */
class TestRunnerOp extends Op
{
  name = 'TestRunnerOp';

  async run(io?: IOContext)
  {
    const { stdout } = this.getIO(io);

    stdout.write('\n╔═══════════════════════════════════════════════════════╗\n');
    stdout.write('║         OUTCOME HANDLER TEST SUITE                   ║\n');
    stdout.write('╚═══════════════════════════════════════════════════════╝\n');

    // Test 1
    stdout.write('\n📝 TEST 1: Re-run parent on cancel\n');
    stdout.write('═══════════════════════════════════════════\n');
    const menu = new MenuOp();
    await menu.run(io);

    // Test 2
    stdout.write('\n\n📝 TEST 2: Re-run on any failure\n');
    stdout.write('═══════════════════════════════════════════\n');
    const retry = new RetryOnAnyFailureOp();
    await retry.run(io);

    // Test 3
    stdout.write('\n\n📝 TEST 3: Re-run on success\n');
    stdout.write('═══════════════════════════════════════════\n');
    const retrySuccess = new RetryOnSuccessOp();
    await retrySuccess.run(io);

    // Test 4
    stdout.write('\n\n📝 TEST 4: Route to different ops\n');
    stdout.write('═══════════════════════════════════════════\n');
    const router = new RouterOp();
    await router.run(io);

    stdout.write('\n\n✅ ALL TESTS COMPLETE!\n\n');
    return this.succeed(undefined);
  }
}

if (import.meta.main)
{
  const { opRunner } = parseOpRunnerArgs(process.argv.slice(2));
  const test = new TestRunnerOp();
  const runner = await OpRunner.create(test, opRunner);
  await runner.run();
}
