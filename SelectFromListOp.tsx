#!/usr/bin/env bun

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
export type RichOption<ValueT> = {
  /**
   Display text for the option
   */
  title: string;

  value?: ValueT;

  /**
   Keyboard shortcut(s) to select this option. Can be a single key or an array of keys.
   */
  key?: string | string[];

  /**
   Whether key matching is case-sensitive (default: false)
   */
  caseSensitive?: boolean;

  /**
   Optional help text displayed when this option is highlighted.
   Shown in a fixed-height area below the options list.
   */
  helpText?: string;
};

/**
 Union type for all supported option formats
 */
export type SelectOption = SimpleOption | RichOption<unknown>;

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

 @example Rich options with keyboard shortcuts and help text
 ```typescript
 const options = [
   {
     title: '[A]ctivate',
     key: 'a',
     helpText: 'This action cannot be undone!'
   },
   {
     title: '[D]isable',
     key: 'd',
     helpText: 'Temporarily disable the feature.'
   },
   {
     title: '[Q]uit',
     key: 'q'
   }
 ] as const;
 const op = new SelectFromListOp(options);
 const result = await op.run();

 if (result.ok) {
   // User can press 'a', 'd', or 'q' or use arrow keys + Enter
   // Help text appears below options as user navigates
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
    if (answer === 'canceled')
    {
      return this.cancel();
    }

    if (answer === null)
    {
      return this.failWithUnknownError('No selection made');
    }

    // TypeScript doen't knows answer is SuccessT here, because it can't track values through callbacks. :-/
    return this.succeed(answer as SuccessT);
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

  // Example 2: Rich options with keyboard shortcuts and help text
  console.log('Example 2: Rich options with keyboard shortcuts and help text');
  console.log('Navigate with arrows to see help text change. Press A, D, S, or Q to select!\n');
  const richOptions = [
    {
      title: '[A]ctivate feature',
      key: 'a',
      helpText: 'Choosing this option cannot be undone, and may cause you to lose money.\nProceed with caution!',
    },
    {
      title: '[D]isable feature',
      key: 'd',
      helpText: 'This will temporarily disable the feature. You can re-enable it later.',
    },
    {
      title: '[S]how status',
      key: 's',
      helpText: 'Display the current status of all features without making any changes.',
    },
    {
      title: '[Q]uit',
      key: 'q',
      helpText: 'Exit the program immediately.',
    },
  ] as const;
  const op2 = new SelectFromListOp(richOptions);
  const outcome2 = await op2.run();

  if (outcome2.ok)
  {
    const selected = outcome2.value;
    const display = typeof selected === 'string' ? selected : (selected as RichOption<unknown>).title;
    console.log('✅ Selected:', display);
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

  // Example 3: Mixed help text (some options have help, some don't)
  console.log('Example 3: Mixed help text and case-sensitive shortcuts');
  console.log('Notice how the help area maintains fixed height even when some options lack help text!\n');
  const caseSensitiveOptions = [
    {
      title: '[I]mportant (case-sensitive)',
      key: 'I',
      caseSensitive: true,
      helpText: 'Only uppercase "I" will select this option (case-sensitive).',
    },
    {
      title: '[V]iew logs',
      key: 'v',
      // No help text for this option - the help area will show empty space
    },
    {
      title: '[E]xit',
      key: 'e',
      helpText: 'Both "e" and "E" will work (case-insensitive by default).',
    },
  ] as const;
  const op3 = new SelectFromListOp(caseSensitiveOptions);
  const outcome3 = await op3.run();

  if (outcome3.ok)
  {
    const selected = outcome3.value;
    const display = typeof selected === 'string' ? selected : (selected as RichOption<unknown>).title;
    console.log('✅ Selected:', display);
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
