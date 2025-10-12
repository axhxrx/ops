import { render } from 'ink';
import type { IOContext } from './IOContext';
import { Op } from './Op';
import { SelectInput } from './src/ops/ui/components/SelectInput';

/**
 Options for SelectFromListOp
 */
export type SelectFromListOpOptions = {
  /**
   Allow user to press Escape to cancel (Default: false)
   */
  cancelable?: boolean;
};

/**
 Prompt user to select from a list of strings. Returns the selected string on success.

 If you pass an `as const` array for `options`, you can exhaustively check the returned value (it will be typed as one of your input strings).

 @example
 ```typescript
 const options = ['Start game', 'Settings', 'Exit'] as const;
 const op = new SelectFromListOp(options, { cancelable: true });
 const result = await op.run();

 if (result.ok) {
   // result.value is typed as 'Start game' | 'Settings' | 'Exit'
   console.log('Selected:', result.value);
 } else if (result.failure === 'canceled') {
   console.log('User canceled');
 }
 ```
 */
export class SelectFromListOp<OptionsT extends readonly string[]> extends Op
{
  name = 'SelectFromListOp';

  constructor(
    private options: OptionsT,
    private config: SelectFromListOpOptions = {},
  )
  {
    super();
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();
    type SuccessT = typeof this.options[number];
    const ioContext = this.getIO(io);

    let answer: SuccessT | 'canceled' | null = null;

    const { unmount, waitUntilExit } = render(
      <SelectInput
        options={this.options}
        logger={ioContext.logger}
        onSelect={(value) =>
        {
          this.log(io, `Selected: ${value}`);
          answer = value as SuccessT;
          unmount();
        }}
        onCancel={
          this.config.cancelable
            ? () =>
            {
              this.log(io, 'Canceled');
              answer = 'canceled';
              unmount();
            }
            : undefined
        }
      />,
    );

    await waitUntilExit();

    // Handle the three possible outcomes
    if (answer === null)
    {
      return this.failWithUnknownError('No selection made');
    }

    if (answer === 'canceled')
    {
      return this.cancel();
    }

    // TypeScript now knows answer is SuccessT here!
    return this.succeed(answer);
  }
}

if (import.meta.main)
{
  const options = ['Start game', 'Load saved game', 'Settings', 'Exit'] as const;
  const op = new SelectFromListOp(options, { cancelable: true });
  const outcome = await op.run();

  if (outcome.ok)
  {
    console.log('✅ Selected:', outcome.value);
  }
  else if (outcome.failure === 'canceled')
  {
    console.log('🚫 Canceled');
  }
  else
  {
    console.log('❓ Unknown error:', outcome.debugData);
  }
}
