/**
 Game ops for the "Guess My Name" game

 Demonstrates the op-returns-op pattern for stack-based execution
 */

import type { IOContext } from './IOContext';
import { Op } from './Op';
import { PrintOp } from './PrintOp';
import { SelectFromListOp } from './SelectFromListOp';

/**
 Initial game op - prints welcome message then returns SelectNameOp
 */
export class WelcomeOp extends Op
{
  name = 'WelcomeOp';

  async run(io?: IOContext)
  {
    // Print the welcome message using PrintOp (respects IO context!)
    const printOp = new PrintOp('Guess my name!\n\n');
    const printResult = await printOp.run(io);

    if (!printResult.ok)
    {
      return printResult;
    }

    // Return the next op to run
    return this.succeed(new SelectNameOp());
  }
}

/**
 Select a name from the list
 */
export class SelectNameOp extends Op
{
  name = 'SelectNameOp';

  async run(io?: IOContext)
  {
    const selectOp = new SelectFromListOp(['Clinton', 'Trump', 'Obama'] as const);
    const outcome = await selectOp.run(io);

    if (!outcome.ok)
    {
      return this.fail('SelectionFailed' as const);
    }

    // Return the result op based on selection
    return this.succeed(new ResultOp(outcome.value));
  }
}

/**
 Show the result based on the selected name
 */
export class ResultOp extends Op
{
  name = 'ResultOp';

  constructor(private selectedName: string)
  {
    super();
  }

  async run(io?: IOContext)
  {
    // Determine the message based on selection
    let message: string;
    switch (this.selectedName)
    {
      case 'Clinton':
        message = '\n\n👎 You guessed wrong!\n\nGAME OVER\n';
        break;
      case 'Trump':
        message = '\n\n🖕 What?! FUCK YOU, shitbird! Go eat a bag of 🍆🍆🍆\n\nGAME OVER\n';
        break;
      case 'Obama':
        message = '\n\n🏆 That is CORRECT! You won the game.\n\nThank you for playing!\n';
        break;
      default:
        message = '\n\n❓ Unknown name\n\nGAME OVER\n';
        break;
    }

    // Print using PrintOp (respects IO context!)
    const printOp = new PrintOp(message);
    const printResult = await printOp.run(io);

    if (!printResult.ok)
    {
      return printResult;
    }

    // Return nothing - this ends the game (stack will pop and be empty)
    return this.succeed(undefined);
  }
}
