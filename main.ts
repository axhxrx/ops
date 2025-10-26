import process from 'node:process';
import { type OpRunnerArgs, parseOpRunnerArgs } from './args.ts';
import { WelcomeOp } from './GameOps.ts';
import type { Op } from './Op.ts';
import { OpRunner } from './OpRunner.ts';
import type { OutcomeOf } from './Outcome.ts';

export type MainArgs = {
  opRunner: OpRunnerArgs;
  app: Record<string, string>;
};

export async function main<T extends Op>(args: MainArgs, initialOp: T): Promise<OutcomeOf<T>>
{
  // Create the runner with the initial op and config (async!)
  const runner = await OpRunner.create(initialOp, args.opRunner);

  // Run until the stack is empty!
  const finalResult = await runner.run();

  // We are counting on OpRunner to ensure the final result is of type OutcomeOf<T>
  return finalResult as OutcomeOf<T>;
}

/**
 Parse OpRunner-specific args and return remaining args for app-specific parsing
 */
export function parseArgs(): MainArgs
{
  // Parse framework args first
  const { opRunner, remaining } = parseOpRunnerArgs(process.argv.slice(2));

  // Parse app-specific args from remaining
  const app = parseAppArgs(remaining);

  return { opRunner, app };
}

/**
 For now, no app-specific args but there will be later
 */
export function parseAppArgs(_args: string[]): Record<string, string>
{
  // For now, no app-specific args
  // Apps using this lib can extend this to parse their own args
  return {};
}

if (import.meta.main)
{
  const parsedArgs = parseArgs();
  const initialOp = new WelcomeOp();
  await main(parsedArgs, initialOp);
}
