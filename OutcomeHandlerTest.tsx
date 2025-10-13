#!/usr/bin/env bun

/**
 OutcomeHandlerTest - Tests for the outcome handler functionality

 This test demonstrates all the ways outcome handlers can be used:
 1. Re-run parent on cancel (specific failure)
 2. Re-run parent on any failure
 3. Re-run parent on success
 4. Pop both parent and child (false)
 5. Replace child with different op

 Run with: bun OutcomeHandlerTest.tsx
 */

import { parseOpRunnerArgs } from './args';
import type { IOContext } from './IOContext';
import { Op } from './Op';
import { OpRunner } from './OpRunner';

// Enable logging to see the flow
OpRunner.opLoggingEnabled = true;

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
        (outcome) => !outcome.ok && outcome.failure === 'canceled',
      );
    }
    else if (this.runCount === 2)
    {
      // Second run (after child canceled): delegate to child that will succeed
      stdout.write('[MenuOp] Delegating to CancelableOp (will succeed)\n');
      return this.handleOutcome(
        new CancelableOp(false), // will succeed
        (outcome) => !outcome.ok && outcome.failure === 'canceled',
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
        (outcome) => !outcome.ok, // re-run on ANY failure
      );
    }
    else if (this.attempts === 2)
    {
      return this.handleOutcome(
        new FailingOp('timeout'),
        (outcome) => !outcome.ok, // re-run on ANY failure
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
        (outcome) => outcome.ok, // re-run on success!
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
          if (!outcome.ok) return true; // re-run on failure
          if (outcome.value === 'A') return new ChoiceOp('B'); // route to B
          if (outcome.value === 'B') return new ChoiceOp('C'); // route to C
          return false; // done
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
          if (!outcome.ok) return true;
          if (outcome.value === 'C') return false; // done!
          return false;
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
  const { opRunner } = parseOpRunnerArgs(Bun.argv.slice(2));
  const test = new TestRunnerOp();
  const runner = await OpRunner.create(test, opRunner);
  await runner.run();
}
