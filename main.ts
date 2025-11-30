import process from "node:process";
import { type OpRunnerArgs, parseOpRunnerArgs } from "./args.ts";
import { WelcomeOp } from "./GameOps.ts";
import { Op } from "./Op.ts";
import { OpRunner } from "./OpRunner.ts";
import type { OutcomeOf } from "./Outcome.ts";

export type MainArgs = {
  opRunner: OpRunnerArgs;
  app: Record<string, string>;
};

export async function main<T extends Op>(
  getInitialOp: T | ((args: string[]) => T)
): Promise<OutcomeOf<T>> {
  // Parse framework args first
  const { opRunner, remaining } = parseOpRunnerArgs(process.argv.slice(2));

  const initialOp =
    getInitialOp instanceof Op ? getInitialOp : getInitialOp(remaining);

  // Create the runner with the initial op and config (async!)
  const runner = await OpRunner.create(initialOp, opRunner);

  // Run until the stack is empty!
  const finalResult = await runner.run();

  // We are counting on OpRunner to ensure the final result is of type OutcomeOf<T>
  return finalResult as OutcomeOf<T>;
}

/**
 Parse OpRunner-specific args and return remaining args for app-specific parsing
 */
export function parseArgs(): MainArgs {
  // Parse framework args first
  const { opRunner, remaining } = parseOpRunnerArgs(process.argv.slice(2));

  // Parse app-specific args from remaining
  const app = parseAppArgs(remaining);

  return { opRunner, app };
}

/**
 For now, no app-specific args but there will be later
 */
export function parseAppArgs(_args: string[]): Record<string, string> {
  // For now, no app-specific args
  // Apps using this lib can extend this to parse their own args
  return {};
}

if (import.meta.main) {
  const initialOp = new WelcomeOp();
  await main(initialOp);
}
