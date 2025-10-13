import { type OpRunnerArgs, parseOpRunnerArgs } from './args';
import { WelcomeOp } from './GameOps';
import { OpRunner } from './OpRunner';

async function main(args: { opRunner: OpRunnerArgs; app: Record<string, string> })
{
  // Create the initial op
  const initialOp = new WelcomeOp();

  // Create the runner with the initial op and config (async!)
  const runner = await OpRunner.create(initialOp, args.opRunner);

  // Run until the stack is empty!
  await runner.run();
}

/**
 Parse OpRunner-specific args and return remaining args for app-specific parsing
 */
function parseArgs()
{
  // Parse framework args first
  const { opRunner, remaining } = parseOpRunnerArgs(Bun.argv.slice(2));

  // Parse app-specific args from remaining
  const app = parseAppArgs(remaining);

  return { opRunner, app };
}

/**
 For now, no app-specific args but there will be later
 */
function parseAppArgs(_args: string[]): Record<string, string>
{
  // For now, no app-specific args
  // Apps using this lib can extend this to parse their own args
  return {};
}

if (import.meta.main)
{
  await main(parseArgs());
}
