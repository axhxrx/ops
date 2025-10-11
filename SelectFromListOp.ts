// import { Select } from '@cliffy/prompt/select'; // Didn't work in Bun 1.3 😭
import { createSelection } from 'bun-promptx';

import { Op } from './Op';

/**
 Prompt user to select from a list of strings. Returns the selected string on success.

 If you pass an `as const` array for `options`, you can exhaustively check the returned value (it will be typed as one of your input strings).
 */
export class SelectFromListOp<OptionsT extends string[]> extends Op
{
  name = 'SelectFromListOp';

  constructor(private options: OptionsT)
  {
    super();
  }

  async run()
  {
    // const options = this.options.map(option => ({ name: option, value: option }));
    // const choice = await Select.prompt({
    //   message: 'Select something',
    //   options,
    // });
    await Promise.resolve();
    const options = this.options.map(option => ({ text: option }));
    const selectResult = createSelection(options, {
      headerText: 'Select something',
    });

    if (selectResult.error || selectResult.selectedIndex === null)
    {
      return this.unknownError();
    }

    const chosen = options[selectResult.selectedIndex]?.text;
    if (!chosen)
    {
      return this.unknownError();
    }

    type SuccessT = typeof this.options[number];
    const result: SuccessT | undefined = chosen as SuccessT;

    return this.succeed(result);
  }
}
