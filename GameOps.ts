/**
 Game ops for the "Guess My Name" game

 Demonstrates the op-returns-op pattern for stack-based execution
 */

import type { IOContext } from './IOContext';
import { Op } from './Op';
import { SelectFromListOp } from './SelectFromListOp';

/**
 Initial game op - prints welcome message then returns SelectNameOp
 */
export class WelcomeOp extends Op
{
  name = 'WelcomeOp';

  run(_io?: IOContext)
  {
    console.log('Guess my name!\n');

    // Return the next op to run
    return Promise.resolve(this.succeed(new SelectNameOp()));
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

  run(_io?: IOContext)
  {
    switch (this.selectedName)
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
        console.log('\n\n❓ Unknown name\n\nGAME OVER');
        break;
    }

    // Return nothing - this ends the game (stack will pop and be empty)
    return Promise.resolve(this.succeed(undefined));
  }
}
