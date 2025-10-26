import { Box, Text, useInput, useStdout } from 'ink';
import React, { useEffect, useState } from 'react';
import type { Form, FormItem } from './FormPrimitives.ts';
import type { Logger } from './Logger.ts';
import type { InfoPanel } from './MenuPrimitives.ts';
import { getDisplayWidth, padToWidth } from './StringUtils.ts';

/**
 * Props for FormView component
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormViewProps<T extends Record<string, FormItem<any>>>
{
  /**
   * The form definition
   */
  form: Form<T>;

  /**
   * Callback when user submits the form (all validation passes)
   */
  onSubmit: (values: Record<string, unknown>) => void;

  /**
   * Callback when user cancels
   */
  onCancel?: () => void;

  /**
   * Fill terminal height by adding spacer
   */
  fillHeight?: boolean;

  /**
   * Optional logger for debug output
   */
  logger?: Logger;
}

/**
 * Custom text input component (simpler than InkTextInput)
 * Renders character-by-character with cursor
 */
const CustomTextInput = ({
  value,
  placeholder,
  isFocused,
  showCursor = true,
  cursorPosition = 0,
  masked = false,
}: {
  value: string;
  placeholder?: string;
  isFocused: boolean;
  showCursor?: boolean;
  cursorPosition?: number;
  masked?: boolean;
}) =>
{
  const showPlaceholder = !value && placeholder;

  // For masked fields (passwords), show asterisks instead of actual value
  const displayValue = masked && value ? '*'.repeat(value.length) : value;

  // If showing placeholder, display it; otherwise show the actual/masked value
  const text = showPlaceholder ? placeholder : displayValue;

  // Cursor position: for placeholder, cursor is at start; for actual text, at end or specified position
  const cursorPos = showPlaceholder ? 0 : cursorPosition;

  // When showing cursor, split text around cursor position
  // When not showing cursor, display full text
  if (isFocused && showCursor)
  {
    return (
      <Text color='cyan' dimColor={showPlaceholder ? true : undefined}>
        {(text || '').slice(0, cursorPos)}
        <Text inverse>{(text || '').charAt(cursorPos) || ' '}</Text>
        {(text || '').slice(cursorPos + 1)}
      </Text>
    );
  }

  // Not focused or no cursor - show full text
  return (
    <Text dimColor={showPlaceholder ? true : undefined}>
      {text || ''}
    </Text>
  );
};

/**
 * Render an InfoPanel (borrowed from MenuOp pattern)
 */
const renderInfoPanel = (panel: InfoPanel | undefined, terminalWidth: number): React.JSX.Element | null =>
{
  if (!panel) return null;

  const lines = panel.resolve();
  const padding = panel.getPadding();

  return (
    <Box flexDirection='column' paddingX={padding}>
      {lines.map((line, idx) =>
      {
        if (typeof line === 'string')
        {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore - React 19 strictness with key prop
          return <Text key={idx}>{line}</Text>;
        }
        else
        {
          // Array of strings - distribute across width
          const availableWidth = terminalWidth - padding * 2;
          const columnWidth = Math.floor(availableWidth / line.length);

          return (
            <Box key={idx}>
              {line.map((col, colIdx) => (
                <Box key={colIdx} width={columnWidth}>
                  <Text>{padToWidth(col, columnWidth, colIdx === 0 ? 'left' : colIdx === line.length - 1 ? 'right' : 'center')}</Text>
                </Box>
              ))}
            </Box>
          );
        }
      })}
    </Box>
  );
};

/**
 * FormView - Interactive form display component
 *
 * Features:
 * - Tab/Shift+Tab navigation between fields
 * - Visual highlighting of active field
 * - Real-time validation feedback
 * - Support for text, number, and boolean fields
 * - Full-screen rendering
 *
 * @example
 * ```tsx
 * <FormView
 *   form={myForm}
 *   onSubmit={(values) => console.log('Submitted:', values)}
 *   onCancel={() => console.log('Canceled')}
 * />
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormView = <T extends Record<string, FormItem<any>>>({
  form,
  onSubmit,
  onCancel,
  fillHeight = true,
  logger,
}: FormViewProps<T>) =>
{
  // Get terminal dimensions
  const { stdout } = useStdout();
  const [terminalSize, setTerminalSize] = useState({
    width: stdout?.columns ?? 80,
    height: stdout?.rows ?? 24,
  });

  // Listen to resize events
  useEffect(() =>
  {
    if (!stdout) return;

    const handleResize = () =>
    {
      setTerminalSize({
        width: stdout.columns,
        height: stdout.rows,
      });
      logger?.log(`Terminal resized: ${stdout.columns}x${stdout.rows}`);
    };

    stdout.on('resize', handleResize);
    process.on('SIGWINCH', handleResize);

    return () =>
    {
      stdout.off('resize', handleResize);
      process.off('SIGWINCH', handleResize);
    };
  }, [stdout, logger]);

  const terminalWidth = terminalSize.width;
  const terminalHeight = terminalSize.height;

  // Form state
  const items = form.getItems();
  const defaultValues = form.getDefaultValues();

  const [values, setValues] = useState<Record<string, unknown>>(defaultValues);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [handled, setHandled] = useState(false);

  // Cursor positions for each text/password field (key -> position)
  const [cursorPositions, setCursorPositions] = useState<Record<string, number>>({});

  // Calculate label column width (max label width + padding)
  const maxLabelWidth = Math.max(
    ...items.map((item) =>
    {
      const label = item.getLabel();
      const required = item.isRequired() ? ' *' : '';
      return getDisplayWidth(label + required);
    }),
    15, // minimum label width
  );
  const labelColWidth = Math.min(maxLabelWidth + 2, 30); // Cap at 30

  // Handle keyboard input
  useInput((input, key) =>
  {
    if (handled) return;

    const currentItem = items[focusedIndex];
    if (!currentItem) return;

    // Escape - cancel
    if (key.escape && onCancel)
    {
      setHandled(true);
      logger?.log('Form canceled');
      onCancel();
      return;
    }

    // Tab - next field
    if (key.tab && !key.shift)
    {
      setFocusedIndex((prev: number) => (prev + 1) % items.length);
      return;
    }

    // Shift+Tab - previous field
    if (key.tab && key.shift)
    {
      setFocusedIndex((prev: number) => (prev - 1 + items.length) % items.length);
      return;
    }

    // Arrow Down - next field (unless we're in a text field with cursor not at start)
    if (key.downArrow)
    {
      setFocusedIndex((prev: number) => (prev + 1) % items.length);
      return;
    }

    // Arrow Up - previous field OR move cursor to start in text fields
    if (key.upArrow)
    {
      if (currentItem.type === 'text' || currentItem.type === 'password')
      {
        const cursorPos = cursorPositions[currentItem.key] ?? (values[currentItem.key] as string).length;
        if (cursorPos > 0)
        {
          // Move cursor to start
          setCursorPositions((prev: Record<string, number>) => ({ ...prev, [currentItem.key]: 0 }));
          return;
        }
      }
      // Otherwise, move to previous field
      setFocusedIndex((prev: number) => (prev - 1 + items.length) % items.length);
      return;
    }

    // Arrow Left - move cursor left in text fields
    if (key.leftArrow && (currentItem.type === 'text' || currentItem.type === 'password'))
    {
      const cursorPos = cursorPositions[currentItem.key] ?? (values[currentItem.key] as string).length;
      if (cursorPos > 0)
      {
        setCursorPositions((prev: Record<string, number>) => ({ ...prev, [currentItem.key]: cursorPos - 1 }));
      }
      return;
    }

    // Arrow Right - move cursor right in text fields
    if (key.rightArrow && (currentItem.type === 'text' || currentItem.type === 'password'))
    {
      const currentStr = values[currentItem.key] as string;
      const cursorPos = cursorPositions[currentItem.key] ?? currentStr.length;
      if (cursorPos < currentStr.length)
      {
        setCursorPositions((prev: Record<string, number>) => ({ ...prev, [currentItem.key]: cursorPos + 1 }));
      }
      return;
    }

    // Ctrl+Enter - submit from anywhere
    if (key.return && key.ctrl)
    {
      handleSubmit();
      return;
    }

    // Enter - submit if on last field, otherwise next field
    if (key.return)
    {
      if (focusedIndex === items.length - 1)
      {
        handleSubmit();
      }
      else
      {
        setFocusedIndex((prev: number) => (prev + 1) % items.length);
      }
      return;
    }

    // Handle field input
    handleFieldInput(currentItem, input, key);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFieldInput = (item: FormItem<any>, input: string, key: { backspace?: boolean; delete?: boolean }) =>
  {
    const currentValue = values[item.key];

    if (item.type === 'text' || item.type === 'password')
    {
      let newValue = currentValue as string;
      const cursorPos = cursorPositions[item.key] ?? newValue.length;

      // Handle backspace - delete character before cursor
      // Note: Some terminals send key.delete=true for backspace when input is empty
      if (key.backspace || (key.delete && input === ''))
      {
        if (cursorPos > 0)
        {
          // Delete character before cursor
          newValue = newValue.slice(0, cursorPos - 1) + newValue.slice(cursorPos);
          setCursorPositions((prev: Record<string, number>) => ({ ...prev, [item.key]: cursorPos - 1 }));
        }
      }
      // Handle actual delete key - delete character at cursor
      // Real delete key sends actual character or different input
      else if (key.delete && input !== '')
      {
        if (cursorPos < newValue.length)
        {
          // Delete character at cursor
          newValue = newValue.slice(0, cursorPos) + newValue.slice(cursorPos + 1);
        }
      }
      // Handle regular character input
      else if (input && input.length > 0)
      {
        // Insert character at cursor position
        newValue = newValue.slice(0, cursorPos) + input + newValue.slice(cursorPos);
        setCursorPositions((prev: Record<string, number>) => ({ ...prev, [item.key]: cursorPos + 1 }));
      }

      setValues((prev: Record<string, unknown>) => ({ ...prev, [item.key]: newValue }));

      // Validate on change if user has attempted submit
      if (hasAttemptedSubmit)
      {
        const error = item.validate(newValue);
        setErrors((prev: Record<string, string>) => ({ ...prev, [item.key]: error ?? '' }));
      }
    }
    else if (item.type === 'number')
    {
      let newValue = currentValue as number;
      const strValue = String(newValue);

      // Handle backspace for number fields
      // Note: Some terminals send key.delete=true for backspace when input is empty
      if (key.backspace || (key.delete && input === ''))
      {
        const newStr = strValue.slice(0, -1);
        newValue = newStr === '' || newStr === '-' ? 0 : parseInt(newStr, 10);
      }
      else if (input && /^[0-9-]$/.test(input))
      {
        // Only allow digits and minus sign
        const newStr = strValue === '0' ? input : strValue + input;
        const parsed = parseInt(newStr, 10);
        if (!isNaN(parsed))
        {
          newValue = parsed;
        }
      }

      setValues((prev: Record<string, unknown>) => ({ ...prev, [item.key]: newValue }));

      // Validate on change if user has attempted submit
      if (hasAttemptedSubmit)
      {
        const error = item.validate(newValue);
        setErrors((prev: Record<string, string>) => ({ ...prev, [item.key]: error ?? '' }));
      }
    }
    else if (item.type === 'boolean')
    {
      // Toggle with space, y/n, or enter
      if (input === ' ' || input === 'y' || input === 'n')
      {
        const newValue = input === 'n' ? false : input === 'y' ? true : !(currentValue as boolean);
        setValues((prev: Record<string, unknown>) => ({ ...prev, [item.key]: newValue }));

        // Validate on change if user has attempted submit
        if (hasAttemptedSubmit)
        {
          const error = item.validate(newValue);
          setErrors((prev: Record<string, string>) => ({ ...prev, [item.key]: error ?? '' }));
        }
      }
    }
  };

  const handleSubmit = () =>
  {
    setHasAttemptedSubmit(true);

    // Validate all fields
    const validationErrors = form.validateAll(values as never);

    if (Object.keys(validationErrors).length > 0)
    {
      // Has errors - show them
      setErrors(validationErrors);
      logger?.log(`Form validation failed: ${JSON.stringify(validationErrors)}`);
      return;
    }

    // All valid - submit!
    setHandled(true);
    logger?.log(`Form submitted: ${JSON.stringify(values)}`);
    onSubmit(values);
  };

  // Calculate spacer height for fillHeight
  let spacerHeight = 0;
  if (fillHeight)
  {
    let contentHeight = 0;

    // Title
    if (form.getTitle()) contentHeight += 2;

    // Header
    const header = form.getHeader();
    if (header) contentHeight += header.resolve().length + 2;

    // Form fields (each field + error line)
    contentHeight += items.length * 2;

    // Footer
    const footer = form.getFooter();
    if (footer) contentHeight += footer.resolve().length + 2;

    // Shortcuts
    contentHeight += 2;

    spacerHeight = Math.max(0, terminalHeight - contentHeight - 1);
  }

  // Render shortcuts
  const renderShortcuts = () =>
  {
    const shortcuts: string[] = [];
    shortcuts.push('Tab: Next field');
    shortcuts.push('Shift+Tab: Previous');
    shortcuts.push('Enter: Submit');
    if (onCancel)
    {
      shortcuts.push('Esc: Cancel');
    }
    return <Text dimColor italic>{shortcuts.join(' | ')}</Text>;
  };

  return (
    <Box flexDirection='column'>
      {/* Title */}
      {form.getTitle() && (
        <Box marginBottom={1}>
          <Text bold color='cyan'>
            {form.getTitle()}
          </Text>
        </Box>
      )}

      {/* Header */}
      {renderInfoPanel(form.getHeader(), terminalWidth)}

      {/* Form fields */}
      <Box flexDirection='column' marginTop={1} marginBottom={1}>
        {items.map((item, idx) =>
        {
          const isFocused = idx === focusedIndex;
          const value = values[item.key];
          const error = errors[item.key];
          const label = item.getLabel();
          const required = item.isRequired() ? ' *' : '';
          const labelText = label + required;

          return (
            <Box key={item.key} flexDirection='column' marginBottom={1}>
              {/* Field row */}
              <Box>
                {/* Label column */}
                <Box width={labelColWidth} marginRight={2}>
                  <Text
                    color={item.getLabelColor()}
                    bold={item.isLabelBold() || isFocused}
                    inverse={isFocused}
                  >
                    {padToWidth(labelText, labelColWidth - 2, 'right')}
                  </Text>
                </Box>

                {/* Input column */}
                <Box>
                  {item.type === 'text' && (
                    <CustomTextInput
                      value={value as string}
                      placeholder={item.getPlaceholder()}
                      isFocused={isFocused}
                      cursorPosition={cursorPositions[item.key] ?? (value as string).length}
                    />
                  )}

                  {item.type === 'password' && (
                    <CustomTextInput
                      value={value as string}
                      placeholder={item.getPlaceholder()}
                      isFocused={isFocused}
                      cursorPosition={cursorPositions[item.key] ?? (value as string).length}
                      masked={true}
                    />
                  )}

                  {item.type === 'number' && (
                    <CustomTextInput
                      value={String(value)}
                      placeholder={item.getPlaceholder()}
                      isFocused={isFocused}
                    />
                  )}

                  {item.type === 'boolean' && (
                    <Text color={isFocused ? 'cyan' : undefined} inverse={isFocused}>
                      {value ? 'Yes' : 'No'}
                      {isFocused && ' (y/n/space)'}
                    </Text>
                  )}
                </Box>
              </Box>

              {/* Error row */}
              {error && (
                <Box marginLeft={labelColWidth + 2}>
                  <Text color='red'>❌ {error}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Spacer */}
      {spacerHeight > 0 && <Box key='form-spacer' height={spacerHeight} />}

      {/* Footer */}
      {renderInfoPanel(form.getFooter(), terminalWidth)}

      {/* Shortcuts */}
      <Box marginTop={1}>
        {renderShortcuts()}
      </Box>
    </Box>
  );
};
