import { Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useState } from 'react';
import type { Logger } from '../../../../Logger';

/**
 Props for ConfirmInput component
 */
export interface ConfirmInputProps
{
  /**
   Prompt text to display above the input
   */
  prompt?: string;

  /**
   Placeholder text (default: '(y/N)')
   */
  placeholder?: string;

  /**
   Callback when user submits (presses Enter)

   @param result - true if confirmed (y/yes), false otherwise
   */
  onResult: (result: boolean) => void;

  /**
   Optional callback when user cancels (presses Escape). If not provided, escape key is ignored.
   */
  onCancel?: () => void;

  /**
   Default value when user just presses Enter (default: false)
   */
  defaultValue?: boolean;

  /**
   Optional logger for debug output
   */
  logger?: Logger;
}

/**
 ConfirmInput - A black-box React component for yes/no confirmation

 Features:
 - Type y/yes/n/no (case insensitive)
 - Press Enter to submit
 - Press Escape to cancel (if onCancel provided)
 - Empty Enter uses defaultValue

 @example
 ```tsx
 <ConfirmInput
   prompt="Delete this file?"
   defaultValue={false}
   onResult={(confirmed) => console.log(confirmed)}
   onCancel={() => console.log('Canceled')}
 />
 ```
 */
export const ConfirmInput = ({
  prompt,
  placeholder = '(y/N)',
  onResult,
  onCancel,
  defaultValue = false,
  logger,
}: ConfirmInputProps) =>
{
  // Track if we've already handled the input to prevent double-submission
  let answered = false;
  const [value, setValue] = useState('');

  // Handle escape key separately from TextInput
  // TextInput handles regular text input and Enter key
  useInput((_input, key) =>
  {
    if (key.escape && onCancel && !answered)
    {
      answered = true;
      onCancel();
    }
  });

  const handleChange = (newValue: string) =>
  {
    logger?.log(`handleChange: ${newValue}`);
    setValue(newValue);
  };

  const handleSubmit = (submitValue: string) =>
  {
    logger?.log(`handleSubmit: ${submitValue}`);
    if (!answered)
    {
      answered = true;
      const normalized = submitValue.toLowerCase().trim();

      if (normalized === '')
      {
        // Empty input - use default
        onResult(defaultValue);
      }
      else
      {
        // Check if it's a yes
        const confirmed = normalized === 'y' || normalized === 'yes';
        onResult(confirmed);
      }
    }
  };

  return (
    <>
      {prompt && <Text>{prompt} </Text>}
      <TextInput
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
    </>
  );
};
