import { Text, useInput } from 'ink';
import InkTextInput from 'ink-text-input';
import { useState } from 'react';
import type { Logger } from './Logger';

/**
 Props for TextInputComponent
 */
export interface TextInputComponentProps
{
  /**
   Prompt text to display above the input
   */
  prompt?: string;

  /**
   Placeholder text
   */
  placeholder?: string;

  /**
   Initial value for the input
   */
  initialValue?: string;

  /**
   Callback when user submits (presses Enter). Only called if validation passes.

   @param value - The input text
   */
  onSubmit: (value: string) => void;

  /**
   Optional callback when user cancels (presses Escape). If not provided, escape key is ignored.
   */
  onCancel?: () => void;

  /**
   Optional validation function. Return error message string if invalid, or undefined if valid.

   @param value - The current input text
   @returns Error message if invalid, undefined if valid
   */
  validate?: (value: string) => string | undefined;

  /**
   Optional logger for debug output
   */
  logger?: Logger;
}

/**
 TextInputComponent - A black-box React component for text input with validation

 Features:
 - Type any text
 - Press Enter to submit (if validation passes)
 - Press Escape to cancel (if onCancel provided)
 - Optional validation with error display
 - Shows validation errors in real-time

 @example
 ```tsx
 <TextInputComponent
   prompt="Enter your name:"
   placeholder="John Doe"
   validate={(value) => value.length < 2 ? 'Name too short' : undefined}
   onSubmit={(value) => console.log('Name:', value)}
   onCancel={() => console.log('Canceled')}
 />
 ```
 */
export const TextInputComponent = ({
  prompt,
  placeholder,
  initialValue = '',
  onSubmit,
  onCancel,
  validate,
  logger: _logger,
}: TextInputComponentProps) =>
{
  // Track if we've already handled the input to prevent double-submission
  let answered = false;
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | undefined>();
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Handle escape key separately from InkTextInput
  // InkTextInput handles regular text input and Enter key
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
    setValue(newValue);

    // Only validate on change if user has already attempted to submit
    // This prevents showing errors while they're still typing the first time
    if (hasAttemptedSubmit && validate)
    {
      const validationError = validate(newValue);
      setError(validationError);
    }
  };

  const handleSubmit = (submitValue: string) =>
  {
    if (!answered)
    {
      // Mark that user has attempted submission
      setHasAttemptedSubmit(true);

      // Validation check
      if (validate)
      {
        const validationError = validate(submitValue);
        if (validationError)
        {
          // Show error and prevent submission
          setError(validationError);
          return;
        }
      }

      // Validation passed - submit!
      answered = true;
      onSubmit(submitValue);
    }
  };

  return (
    <>
      {prompt && <Text>{prompt}</Text>}
      <InkTextInput
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
      {error && (
        <Text color='red'>
          {' '}
          ❌ {error}
        </Text>
      )}
    </>
  );
};
