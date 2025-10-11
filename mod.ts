import { assertNever } from '@axhxrx/assert-never';
import { PrintOp } from './Op.examples';
import { SelectFromListOp } from './SelectFromListOp';

async function main(_args: Record<string, string>)
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
      console.log('Clinton\n\n👎 You guessed wrong!\n\nGAME OVER');
      break;
    case 'Trump':
      console.log('💩💩💩💩💩\n\n🖕 What?! FUCK YOU, shitbird! Go eat a bag of 🍆🍆🍆\n\nGAME OVER');
      break;
    case 'Obama':
      console.log('Obama\n\n🏆 That is CORRECT! You won the game.\n\nThank you for playing!');
      break;
    default:
      assertNever(selectedName);
      break;
  }
}

function parseArgs()
{
  return {};
}

if (import.meta.main)
{
  await main(parseArgs());
}
