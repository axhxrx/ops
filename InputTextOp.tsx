import { render } from 'ink';
import { TextInputComponent } from './InputTextOp.ui.tsx';
import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';

/**
 Options for InputTextOp
 */
export type InputTextOpOptions = {
  /**
   Allow user to press Escape to cancel (Default: false)
   */
  cancelable?: boolean;

  /**
   Placeholder text to show when input is empty
   */
  placeholder?: string;

  /**
   Initial value for the input
   */
  initialValue?: string;

  /**
   Minimum length validation (Default: no minimum)
   */
  minLength?: number;

  /**
   Maximum length validation (Default: no maximum)
   */
  maxLength?: number;

  /**
   Regex pattern validation. Input must match this pattern.
   */
  pattern?: RegExp;

  /**
   Custom validation function. Return error message if invalid, undefined if valid.

   @param value - The input text
   @returns Error message if invalid, undefined if valid
   */
  validator?: (value: string) => string | undefined;
};

/**
 InputTextOp - Prompt user for text input with validation

 Success value: string (the input text)
 Failure: 'canceled' if user presses Escape (when cancelable: true)

 @example
 ```typescript
 const op = new InputTextOp('Enter your email:', {
   cancelable: true,
   placeholder: 'user@example.com',
   pattern: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
 });
 const result = await op.run();

 if (result.ok) {
   console.log('Email:', result.value);
 } else if (result.failure === 'canceled') {
   console.log('User canceled');
 }
 ```
 */
export class InputTextOp extends Op
{
  name = 'InputTextOp';

  constructor(
    private prompt: string,
    private options: InputTextOpOptions = {},
  )
  {
    super();
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();
    const ioContext = this.getIO(io);

    let resultValue: string | null = null;
    let wasCanceled = false;

    // Build composite validator from options
    const validator = (value: string): string | undefined =>
    {
      // Min length check
      if (this.options.minLength !== undefined && value.length < this.options.minLength)
      {
        return `Must be at least ${this.options.minLength} characters`;
      }

      // Max length check
      if (this.options.maxLength !== undefined && value.length > this.options.maxLength)
      {
        return `Must be at most ${this.options.maxLength} characters`;
      }

      // Pattern check
      if (this.options.pattern && !this.options.pattern.test(value))
      {
        return 'Invalid format';
      }

      // Custom validator
      if (this.options.validator)
      {
        return this.options.validator(value);
      }

      return undefined;
    };

    const { unmount, waitUntilExit } = render(
      <TextInputComponent
        prompt={this.prompt}
        placeholder={this.options.placeholder}
        initialValue={this.options.initialValue}
        validate={validator}
        logger={ioContext.logger}
        onSubmit={(value) =>
        {
          this.log(io, `Submitted: ${value}`);
          resultValue = value;
          unmount();
        }}
        onCancel={this.options.cancelable
          ? () =>
          {
            this.log(io, 'Canceled');
            wasCanceled = true;
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
    if (wasCanceled)
    {
      return this.cancel();
    }

    if (resultValue === null)
    {
      return this.failWithUnknownError('No input provided');
    }

    return this.succeed(resultValue);
  }
}

if (import.meta.main)
{
  // Example 1: Simple text input
  const nameOp = new InputTextOp('Enter your name:', {
    cancelable: true,
    minLength: 2,
    maxLength: 50,
  });

  const nameResult = await nameOp.run();

  if (nameResult.ok)
  {
    console.log('✅ Name:', nameResult.value);

    // Example 2: Email with pattern validation
    const emailOp = new InputTextOp('Enter your email:', {
      cancelable: true,
      placeholder: 'user@example.com',
      pattern: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
    });

    const emailResult = await emailOp.run();

    if (emailResult.ok)
    {
      console.log('✅ Email:', emailResult.value);
    }
    else if (emailResult.failure === 'canceled')
    {
      console.log('🚫 Email canceled');
    }
  }
  else if (nameResult.failure === 'canceled')
  {
    console.log('🚫 Name canceled');
  }
  else
  {
    console.log('❓ Unknown error:', nameResult.debugData);
  }
}
