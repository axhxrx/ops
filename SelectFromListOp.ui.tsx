import { useInput } from 'ink';
import InkSelectInput from 'ink-select-input';
import type { Logger } from './Logger';

/**
 Props for SelectInput component
 */
export interface SelectInputProps<T extends string>
{
  /**
   Array of options to select from
   */
  options: readonly T[];

  /**
   Callback when user selects an item (presses Enter)

   @param value - The selected string value
   */
  onSelect: (value: T) => void;

  /**
   Optional callback when user cancels (presses Escape). If not provided, escape key is ignored.
   */
  onCancel?: () => void;

  /**
   Optional logger for debug output
   */
  logger?: Logger;
}

/**
 SelectInput - A black-box React component for selecting from a list

 Features:
 - Navigate with arrow keys
 - Press Enter to select
 - Press Escape to cancel (if onCancel provided)
 - Type-safe: returns one of the provided options

 @example
 ```tsx
 const options = ['Option A', 'Option B', 'Option C'] as const;
 <SelectInput
   options={options}
   onSelect={(value) => console.log('Selected:', value)}
   onCancel={() => console.log('Canceled')}
 />
 ```
 */
export const SelectInput = <T extends string>({
  options,
  onSelect,
  onCancel,
  logger,
}: SelectInputProps<T>) =>
{
  // Track if we've already handled selection to prevent double-submission
  let answered = false;

  // Handle escape key separately from InkSelectInput
  // InkSelectInput handles arrow keys and Enter
  useInput((_input, key) =>
  {
    if (key.escape && onCancel && !answered)
    {
      answered = true;
      logger?.log('Escape pressed - canceling');
      onCancel();
    }
  });

  const items = options.map((option, index) => ({
    label: option,
    value: option,
    key: `${option}-${index}`,
  }));

  const handleSelect = (item: { label: string; value: string }) =>
  {
    if (!answered)
    {
      answered = true;
      logger?.log(`Selected: ${item.value}`);
      onSelect(item.value as T);
    }
  };

  return <InkSelectInput items={items} onSelect={handleSelect} />;
};
