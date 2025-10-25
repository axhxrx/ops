import { render } from 'ink';
import { ConfirmInput } from './ConfirmOp.ui.tsx';
import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';

/**
 Options for ConfirmOp
 */
export type ConfirmOpOptions = {
  /**
   Allow user to press Escape to cancel (Default: false (must make a choice))
   */
  cancelable?: boolean;

  /**
   Default value (what happens if user just presses Enter (Default: false)
   */
  defaultValue?: boolean;

  /**
   Placeholder text to show (Default: '(y/N)')
   */
  placeholder?: string;
};

/**
 ConfirmOp - Yes/No confirmation prompt

 Wraps ink-confirm-input with cancellation support and IOContext integration.

 Success value: boolean (true for yes, false for no)
 Failure: 'canceled' if user presses Escape (when cancelable: true)

 @example
 ```typescript
 const op = new ConfirmOp('Delete this file?', {
   cancelable: true,
   defaultValue: false
   });
   const result = await op.run(io);

 if (result.ok) {
   console.log(result.value ? 'Confirmed!' : 'Declined');
   } else if (result.failure === 'canceled') {
   console.log('User canceled');
   }
   ```
 */
export class ConfirmOp extends Op
{
  name = 'ConfirmOp';

  constructor(
    private prompt: string,
    private options: ConfirmOpOptions = {},
  )
  {
    super();
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();
    const ioContext = this.getIO(io);

    let answer: boolean | 'canceled' | null = null;

    const { unmount, waitUntilExit } = render(
      <ConfirmInput
        prompt={this.prompt}
        placeholder={this.options.placeholder}
        defaultValue={this.options.defaultValue}
        logger={ioContext.logger}
        onResult={(result) =>
        {
          this.log(io, `onResult: ${result}`);
          answer = result;
          unmount();
        }}
        onCancel={this.options.cancelable
          ? () =>
          {
            this.log(io, 'onCancel');
            answer = 'canceled';
            unmount();
          }
          : undefined}
      />,
      {
        stdin: ioContext.stdin as NodeJS.ReadStream,
        stdout: ioContext.stdout as NodeJS.WriteStream,
      },
    );

    await waitUntilExit();

    // Handle the three possible outcomes
    if (answer === null)
    {
      return this.failWithUnknownError('No answer received');
    }

    if (answer === 'canceled')
    {
      return this.cancel();
    }

    // TypeScript now knows answer is boolean here!
    return this.succeed(answer);
  }
}

if (import.meta.main)
{
  const op = new ConfirmOp('Do you want to continue?', {
    cancelable: true,
    defaultValue: false,
  });
  const outcome = await op.run();

  if (outcome.ok)
  {
    console.log(outcome.value ? '✅ Confirmed!' : '❌ Declined');
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
