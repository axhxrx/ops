/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { assertNever } from '@axhxrx/assert-never';
import { type OpRunnerArgs, parseOpRunnerArgs } from './args';
import { PrintOp } from './Op.examples';
import { SelectFromListOp } from './SelectFromListOp.tsx';

async function main(_args: { opRunner: OpRunnerArgs; app: Record<string, string> })
{
  // const gameOver = false;

  const op = new PrintOp(
    `Guess my name!\n`,
  );
  await op.run();

  const selectOp = new SelectFromListOp(
    ['Clinton', 'Trump', 'Obama'] as const,
  );
  const answer = await selectOp.run();

  if (!answer.ok)
  {
    throw new Error('Failed to select an option');
  }

  const selectedName = answer.value;

  switch (selectedName)
  {
    case 'Clinton':
      console.log('\n\n👎 You guessed wrong!\n\nGAME OVER');
      break;
    case 'Trump':
      console.log('\n\n🖕 What?! FUCK YOU, shitbird! Go eat a bag of 🍆🍆🍆\n\nGAME OVER');
      break;
    case 'Obama':
      console.log('\n\n🏆 That is CORRECT! You won the game.\n\nThank you for playing!');
      break;
    default:
      assertNever(selectedName);
      break;
  }
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
