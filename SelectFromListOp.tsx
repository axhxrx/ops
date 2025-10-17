import { render } from 'ink';
import type { IOContext } from './IOContext';
import { Op } from './Op';
import { SelectInput } from './SelectFromListOp.ui';

/**
 Simple string option (backward compatible)
 */
export type SimpleOption = string;

/**
 Rich option with keyboard shortcut support
 */
export type RichOption = {
  /**
   Display text for the option
   */
  title: string;

  /**
   Keyboard shortcut(s) to select this option. Can be a single key or an array of keys.
   */
  key?: string | string[];

  /**
   Whether key matching is case-sensitive (default: false)
   */
  caseSensitive?: boolean;
};

/**
 Union type for all supported option formats
 */
export type SelectOption = SimpleOption | RichOption;

/**
 Options for SelectFromListOp
 */
export type SelectFromListOpOptions = {
  /**
   Allow user to press Escape to cancel (Default: false)
   */
  cancelable?: boolean;

  /**
   Optional handler for keystrokes that don't match any shortcuts or built-in keys.
   Receives the pressed key as a string
   */
  onKeystroke?: (key: string) => void;
};

/**
 Prompt user to select from a list of options. Returns the selected option on success.

 Supports two formats:
 1. Simple strings: `['Option 1', 'Option 2']`
 2. Rich options with keyboard shortcuts: `[{title: 'Option 1', key: '1'}, ...]`

 If you pass an `as const` array, TypeScript will infer the exact return type.

 @example Simple strings
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

 @example Rich options with keyboard shortcuts
 ```typescript
 const options = [
   {title: '[A]ctivate', key: 'a'},
   {title: '[D]isable', key: 'd'},
   {title: '[Q]uit', key: 'q'}
 ] as const;
 const op = new SelectFromListOp(options);
 const result = await op.run();

 if (result.ok) {
   // User can press 'a', 'd', or 'q' or use arrow keys + Enter
   // result.value is the selected option object
   console.log('Selected:', result.value.title);
 }
 ```
 */
export class SelectFromListOp<OptionsT extends readonly SelectOption[]> extends Op
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
          const displayValue = typeof value === 'string' ? value : value.title;
          this.log(io, `Selected: ${displayValue}`);
          answer = value as SuccessT;
          unmount();
        }}
        onCancel={this.config.cancelable
          ? () =>
          {
            this.log(io, 'Canceled');
            answer = 'canceled';
            unmount();
          }
          : undefined}
        onKeystroke={this.config.onKeystroke}
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
  // Example 1: Simple string options (backward compatible)
  console.log('Example 1: Simple string options\n');
  const simpleOptions = ['Start game', 'Load saved game', 'Settings', 'Exit'] as const;
  const op1 = new SelectFromListOp(simpleOptions, { cancelable: true });
  const outcome1 = await op1.run();

  if (outcome1.ok)
  {
    console.log('✅ Selected:', outcome1.value);
  }
  else if (outcome1.failure === 'canceled')
  {
    console.log('🚫 Canceled');
  }
  else
  {
    console.log('❓ Unknown error:', outcome1.debugData);
  }

  console.log('\n---\n');

  // Example 2: Rich options with keyboard shortcuts
  console.log('Example 2: Rich options with keyboard shortcuts');
  console.log('Try pressing A, D, S, or Q to select directly!\n');
  const richOptions = [
    { title: '[A]ctivate feature', key: 'a' },
    { title: '[D]isable feature', key: 'd' },
    { title: '[S]how status', key: 's' },
    { title: '[Q]uit', key: 'q' },
  ] as const;
  const op2 = new SelectFromListOp(richOptions);
  const outcome2 = await op2.run();

  if (outcome2.ok)
  {
    console.log('✅ Selected:', outcome2.value.title);
  }
  else if (outcome2.failure === 'canceled')
  {
    console.log('🚫 Canceled');
  }
  else
  {
    console.log('❓ Unknown error:', outcome2.debugData);
  }

  console.log('\n---\n');

  // Example 3: Mixed keys with case sensitivity
  console.log('Example 3: Case-sensitive shortcuts');
  console.log('Try uppercase I (case-sensitive) vs lowercase v (case-insensitive)!\n');
  const caseSensitiveOptions = [
    { title: '[I]mportant (case-sensitive)', key: 'I', caseSensitive: true },
    { title: '[V]iew logs', key: 'v' },
    { title: '[E]xit', key: 'e' },
  ] as const;
  const op3 = new SelectFromListOp(caseSensitiveOptions);
  const outcome3 = await op3.run();

  if (outcome3.ok)
  {
    console.log('✅ Selected:', outcome3.value.title);
  }
  else
  {
    console.log('❓ Unknown error:', outcome3.debugData);
  }

  console.log('\n---\n');

  // Example 4: Using onKeystroke handler for custom key handling
  console.log('Example 4: Custom keystroke handler');
  console.log('Try pressing a number key (1-3) - custom handler will log it!\n');
  const optionsWithHandler = ['First option', 'Second option', 'Third option'] as const;
  const op4 = new SelectFromListOp(optionsWithHandler, {
    cancelable: true,
    onKeystroke: (key) => console.log(`Custom handler received key: "${key}"`),
  });
  const outcome4 = await op4.run();

  if (outcome4.ok)
  {
    console.log('✅ Selected:', outcome4.value);
  }
  else if (outcome4.failure === 'canceled')
  {
    console.log('🚫 Canceled');
  }
}
