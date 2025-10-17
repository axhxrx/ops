import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import InkSelectInput from 'ink-select-input';
import type { Logger } from './Logger';
import type { SelectOption } from './SelectFromListOp';

/**
 Props for SelectInput component
 */
export interface SelectInputProps<T extends SelectOption>
{
  /**
   Array of options to select from (strings or rich options)
   */
  options: readonly T[];

  /**
   Callback when user selects an item (presses Enter or a shortcut key)

   @param value - The selected option (string or rich option object)
   */
  onSelect: (value: T) => void;

  /**
   Optional callback when user cancels (presses Escape). If not provided, escape key is ignored.
   */
  onCancel?: () => void;

  /**
   Optional callback for keystrokes that don't match shortcuts or built-in keys
   */
  onKeystroke?: (key: string) => void;

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
 - Press shortcut keys to instantly select (if options have keys defined)
 - Display contextual help text below the options (if provided)
 - Help text area maintains fixed height to prevent UI jumping
 - Type-safe: returns one of the provided options

 @example Simple strings
 ```tsx
 const options = ['Option A', 'Option B', 'Option C'] as const;
 <SelectInput
   options={options}
   onSelect={(value) => console.log('Selected:', value)}
   onCancel={() => console.log('Canceled')}
 />
 ```

 @example Rich options with keyboard shortcuts and help text
 ```tsx
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
     title: '[S]omething else',
     key: 's'
   }
 ] as const;
 <SelectInput
   options={options}
   onSelect={(value) => console.log('Selected:', value.title)}
 />
 ```
 */
export const SelectInput = <T extends SelectOption>({
  options,
  onSelect,
  onCancel,
  onKeystroke,
  logger,
}: SelectInputProps<T>) =>
{
  // Track if we've already handled selection to prevent double-submission
  let answered = false;

  // Track the currently highlighted item index
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Helper to get display label from option
  const getOptionLabel = (option: T): string =>
  {
    return typeof option === 'string' ? option : option.title;
  };

  // Helper to get help text from option
  const getOptionHelpText = (option: T): string | undefined =>
  {
    return typeof option === 'string' ? undefined : option.helpText;
  };

  // Calculate the maximum number of lines needed for help text
  // This ensures the help area has a fixed height and doesn't jump around
  const maxHelpTextLines = options.reduce((max, option) =>
  {
    const helpText = getOptionHelpText(option);
    if (!helpText) return max;
    const lines = helpText.split('\n').length;
    return Math.max(max, lines);
  }, 0);

  // Get the current help text to display
  const currentHelpText = getOptionHelpText(options[highlightedIndex]!);

  // Build keyboard shortcut maps
  // We use two maps: one for exact (case-sensitive) matches, one for case-insensitive
  const exactMap = new Map<string, T>();
  const caseInsensitiveMap = new Map<string, T>();

  for (const option of options)
  {
    if (typeof option !== 'string' && option.key)
    {
      const keys = Array.isArray(option.key) ? option.key : [option.key];
      const caseSensitive = option.caseSensitive ?? false;

      for (const key of keys)
      {
        if (caseSensitive)
        {
          // Case-sensitive: only exact match
          if (!exactMap.has(key))
          {
            exactMap.set(key, option);
          }
        }
        else
        {
          // Case-insensitive: normalize to lowercase
          const normalizedKey = key.toLowerCase();
          if (!caseInsensitiveMap.has(normalizedKey))
          {
            caseInsensitiveMap.set(normalizedKey, option);
          }
        }
      }
    }
  }

  // Helper to find option by keystroke
  const findOptionByKey = (input: string): T | undefined =>
  {
    // First try exact match (for case-sensitive keys)
    const exactMatch = exactMap.get(input);
    if (exactMatch !== undefined)
    {
      return exactMatch;
    }
    // Then try case-insensitive match
    const lowerInput = input.toLowerCase();
    const caseInsensitiveMatch = caseInsensitiveMap.get(lowerInput);
    if (caseInsensitiveMatch !== undefined)
    {
      return caseInsensitiveMatch;
    }
    return undefined;
  };

  // Handle keyboard input
  useInput((input, key) =>
  {
    // Handle escape separately
    if (key.escape && onCancel && !answered)
    {
      answered = true;
      logger?.log('Escape pressed - canceling');
      onCancel();
      return;
    }

    // Handle arrow keys to update highlighted index
    if (key.upArrow && !answered)
    {
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      return;
    }

    if (key.downArrow && !answered)
    {
      setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      return;
    }

    // Don't process enter - let InkSelectInput handle it
    if (key.return)
    {
      return;
    }

    // Check if this key matches any option's shortcut
    if (input && !answered)
    {
      const matchedOption = findOptionByKey(input);
      if (matchedOption)
      {
        answered = true;
        logger?.log(`Shortcut key pressed: ${input} -> ${getOptionLabel(matchedOption)}`);
        onSelect(matchedOption);
        return;
      }

      // No match found, call custom handler if provided
      if (onKeystroke)
      {
        onKeystroke(input);
      }
    }
  });

  const items = options.map((option, index) => ({
    label: getOptionLabel(option),
    value: option,
    key: `${getOptionLabel(option)}-${index}`,
  }));

  const handleSelect = (item: { label: string; value: T }) =>
  {
    if (!answered)
    {
      answered = true;
      logger?.log(`Selected: ${getOptionLabel(item.value)}`);
      onSelect(item.value);
    }
  };

  // Render help text area with fixed height
  const renderHelpText = () =>
  {
    if (maxHelpTextLines === 0)
    {
      // No help text in any option, don't render the help area
      return null;
    }

    // Calculate how many lines to display
    const currentLines = currentHelpText ? currentHelpText.split('\n') : [];
    const paddingLines = maxHelpTextLines - currentLines.length;

    return (
      <Box flexDirection="column" marginTop={1}>
        {currentHelpText && (
          <Text dimColor>{currentHelpText}</Text>
        )}
        {/* Add empty lines to maintain fixed height */}
        {Array.from({ length: paddingLines }).map((_, i) => (
          <Text key={`padding-${i}`}>{' '}</Text>
        ))}
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      <InkSelectInput
        items={items}
        onSelect={handleSelect}
        initialIndex={highlightedIndex}
      />
      {renderHelpText()}
    </Box>
  );
};
