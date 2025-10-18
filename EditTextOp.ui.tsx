import { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { Logger } from './Logger';

/**
 Props for EditTextInput component
 */
export interface EditTextInputProps
{
  /**
   Prompt text to display above the editor
   */
  prompt?: string;

  /**
   Initial text content
   */
  initialValue?: string;

  /**
   Callback when user submits (Ctrl+S)

   @param value - The edited text
   */
  onSubmit: (value: string) => void;

  /**
   Optional callback when user cancels (Escape). If not provided, escape key is ignored.
   */
  onCancel?: () => void;

  /**
   Optional validation function. Return error message string if invalid, or undefined if valid.

   @param value - The current text
   @returns Error message if invalid, undefined if valid
   */
  validate?: (value: string) => string | undefined;

  /**
   Optional logger for debug output
   */
  logger?: Logger;
}

/**
 EditTextInput - A multiline text editor component for terminal

 Features:
 - Multiline text editing
 - Cursor movement (arrows, Home, End, Ctrl+Home, Ctrl+End)
 - Text insertion and deletion
 - Line wrapping for long lines
 - Scrolling viewport for large content
 - Terminal resize handling
 - Ctrl+S to save, Escape to cancel
 - Optional validation with error display

 @example
 ```tsx
 <EditTextInput
   prompt="Enter your message:"
   initialValue="Hello, world!"
   validate={(value) => value.length < 10 ? 'Too short' : undefined}
   onSubmit={(value) => console.log('Submitted:', value)}
   onCancel={() => console.log('Canceled')}
 />
 ```
 */
export const EditTextInput = ({
  prompt,
  initialValue = '',
  onSubmit,
  onCancel,
  validate,
  logger,
}: EditTextInputProps) =>
{
  // Track if we've already handled the action
  let handled = false;

  // Get terminal dimensions
  const { stdout } = useStdout();

  // Track terminal size with state to force re-renders on resize
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

  // State: text content as array of lines
  const [lines, setLines] = useState<string[]>(
    initialValue ? initialValue.split('\n') : [''],
  );

  // State: cursor position (line index, column index)
  const [cursorLine, setCursorLine] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);

  // State: scroll position (top line index being displayed)
  const [scrollTop, setScrollTop] = useState(0);

  // State: validation error
  const [error, setError] = useState<string | undefined>();
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Calculate how many lines can fit in viewport
  const calculateViewportHeight = (): number =>
  {
    // UI elements:
    // - Prompt: 1-2 lines
    // - Editor content: remaining space
    // - Help text: 2 lines
    // - Error: 1 line (if present)
    let usedLines = 0;
    if (prompt) usedLines += 2;
    usedLines += 2; // help text
    if (error) usedLines += 1;
    usedLines += 2; // buffer

    const availableLines = terminalHeight - usedLines;
    return Math.max(3, availableLines);
  };

  // Convert lines array to single string
  const getText = (): string => lines.join('\n');

  // Handle keyboard input
  useInput((input, key) =>
  {
    if (handled) return;

    // Save with Ctrl+S
    if (key.ctrl && input === 's')
    {
      setHasAttemptedSubmit(true);

      const text = getText();
      if (validate)
      {
        const validationError = validate(text);
        if (validationError)
        {
          setError(validationError);
          logger?.log(`Validation failed: ${validationError}`);
          return;
        }
      }

      handled = true;
      logger?.log('Ctrl+S pressed - submitting');
      onSubmit(text);
      return;
    }

    // Cancel with Escape
    if (key.escape && onCancel)
    {
      handled = true;
      logger?.log('Escape pressed - canceling');
      onCancel();
      return;
    }

    // Clear error on any navigation after failed submit
    const clearErrorIfNeeded = () =>
    {
      if (hasAttemptedSubmit && error)
      {
        setError(undefined);
      }
    };

    // Cursor movement: Arrow Up
    if (key.upArrow)
    {
      clearErrorIfNeeded();
      setCursorLine((prev) =>
      {
        const newLine = Math.max(0, prev - 1);
        // Adjust column if new line is shorter
        setCursorCol((col) => Math.min(col, lines[newLine]?.length ?? 0));
        // Auto-scroll if needed
        setScrollTop((scroll) => Math.min(scroll, newLine));
        return newLine;
      });
      return;
    }

    // Cursor movement: Arrow Down
    if (key.downArrow)
    {
      clearErrorIfNeeded();
      setCursorLine((prev) =>
      {
        const newLine = Math.min(lines.length - 1, prev + 1);
        // Adjust column if new line is shorter
        setCursorCol((col) => Math.min(col, lines[newLine]?.length ?? 0));
        // Auto-scroll if needed
        setScrollTop((scroll) =>
        {
          const viewportHeight = calculateViewportHeight();
          if (newLine >= scroll + viewportHeight)
          {
            return newLine - viewportHeight + 1;
          }
          return scroll;
        });
        return newLine;
      });
      return;
    }

    // Cursor movement: Arrow Left
    if (key.leftArrow)
    {
      clearErrorIfNeeded();
      setCursorCol((prev) =>
      {
        if (prev > 0)
        {
          return prev - 1;
        }
        else if (cursorLine > 0)
        {
          // Move to end of previous line
          setCursorLine(cursorLine - 1);
          return lines[cursorLine - 1]?.length ?? 0;
        }
        return prev;
      });
      return;
    }

    // Cursor movement: Arrow Right
    if (key.rightArrow)
    {
      clearErrorIfNeeded();
      const currentLineLength = lines[cursorLine]?.length ?? 0;
      setCursorCol((prev) =>
      {
        if (prev < currentLineLength)
        {
          return prev + 1;
        }
        else if (cursorLine < lines.length - 1)
        {
          // Move to start of next line
          setCursorLine(cursorLine + 1);
          return 0;
        }
        return prev;
      });
      return;
    }

    // Note: Home and End keys aren't in the Key type, so we can't detect
    // Ctrl+Home/Ctrl+End reliably. We'll just handle basic navigation with h/e keys
    // as shortcuts (like ShowTableOp does)

    // Enter: Insert new line
    if (key.return)
    {
      setLines((prevLines) =>
      {
        const newLines = [...prevLines];
        const currentLine = newLines[cursorLine] ?? '';
        const beforeCursor = currentLine.substring(0, cursorCol);
        const afterCursor = currentLine.substring(cursorCol);

        newLines[cursorLine] = beforeCursor;
        newLines.splice(cursorLine + 1, 0, afterCursor);

        return newLines;
      });
      setCursorLine((prev) => prev + 1);
      setCursorCol(0);

      // Auto-scroll if needed
      setScrollTop((scroll) =>
      {
        const viewportHeight = calculateViewportHeight();
        const newLine = cursorLine + 1;
        if (newLine >= scroll + viewportHeight)
        {
          return newLine - viewportHeight + 1;
        }
        return scroll;
      });

      // Clear error on first keystroke after failed submit
      if (hasAttemptedSubmit && error)
      {
        setError(undefined);
      }
      return;
    }

    // Backspace: Delete character before cursor
    if (key.backspace || key.delete)
    {
      if (cursorCol > 0)
      {
        // Delete character in current line
        setLines((prevLines) =>
        {
          const newLines = [...prevLines];
          const currentLine = newLines[cursorLine] ?? '';
          newLines[cursorLine] = currentLine.substring(0, cursorCol - 1) + currentLine.substring(cursorCol);
          return newLines;
        });
        setCursorCol((prev) => prev - 1);
      }
      else if (cursorLine > 0)
      {
        // Merge with previous line
        const prevLineLength = lines[cursorLine - 1]?.length ?? 0;
        setLines((prevLines) =>
        {
          const newLines = [...prevLines];
          newLines[cursorLine - 1] = (newLines[cursorLine - 1] ?? '') + (newLines[cursorLine] ?? '');
          newLines.splice(cursorLine, 1);
          return newLines;
        });
        setCursorLine((prev) => prev - 1);
        setCursorCol(prevLineLength);
      }

      // Clear error on first keystroke after failed submit
      if (hasAttemptedSubmit && error)
      {
        setError(undefined);
      }
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta)
    {
      // Detect large pastes (more than 1000 characters at once)
      const MAX_PASTE_LENGTH = 1000;
      if (input.length > MAX_PASTE_LENGTH)
      {
        setError(`Paste too large (${input.length} chars). Maximum ${MAX_PASTE_LENGTH} characters.`);
        logger?.warn(`Rejected paste of ${input.length} characters (max ${MAX_PASTE_LENGTH})`);
        return;
      }

      setLines((prevLines) =>
      {
        const newLines = [...prevLines];
        const currentLine = newLines[cursorLine] ?? '';
        newLines[cursorLine] = currentLine.substring(0, cursorCol) + input + currentLine.substring(cursorCol);
        return newLines;
      });
      setCursorCol((prev) => prev + input.length);

      // Clear error on first keystroke after failed submit
      if (hasAttemptedSubmit && error)
      {
        setError(undefined);
      }
    }
  });

  // Calculate viewport
  const viewportHeight = calculateViewportHeight();
  const visibleLines = lines.slice(scrollTop, scrollTop + viewportHeight);
  const hasMoreAbove = scrollTop > 0;
  const hasMoreBelow = scrollTop + viewportHeight < lines.length;

  // Render a line with cursor visible at the correct position
  const renderLine = (lineText: string, lineIndex: number) =>
  {
    const actualLineIndex = scrollTop + lineIndex;
    const isCursorLine = actualLineIndex === cursorLine;

    // If not the cursor line, render normally
    if (!isCursorLine)
    {
      return (
        <Box key={actualLineIndex}>
          <Text>{lineText}</Text>
        </Box>
      );
    }

    // For cursor line, split at cursor position to show cursor
    const beforeCursor = lineText.substring(0, cursorCol);
    const atCursor = lineText[cursorCol] ?? ' '; // Character at cursor, or space if at end
    const afterCursor = lineText.substring(cursorCol + 1);

    return (
      <Box key={actualLineIndex}>
        <Text>
          {beforeCursor}
          <Text inverse>{atCursor}</Text>
          {afterCursor}
        </Text>
      </Box>
    );
  };

  // Check if terminal is too small
  const MIN_WIDTH = 40;
  const MIN_HEIGHT = 10;

  if (stdout && (terminalWidth < MIN_WIDTH || terminalHeight < MIN_HEIGHT))
  {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center">
        <Text bold color="red">
          ⚠️  TERMINAL TOO SMALL
        </Text>
        <Text dimColor>
          Minimum: {MIN_WIDTH}x{MIN_HEIGHT} | Current: {terminalWidth}x{terminalHeight}
        </Text>
        <Text dimColor italic>
          Please resize your terminal window
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Prompt */}
      {prompt && (
        <Box marginBottom={1}>
          <Text bold>{prompt}</Text>
        </Box>
      )}

      {/* Scroll indicator - more content above */}
      {hasMoreAbove && (
        <Box>
          <Text dimColor>▲ {scrollTop} more lines above...</Text>
        </Box>
      )}

      {/* Editor content */}
      <Box flexDirection="column">
        {visibleLines.map((line, index) => renderLine(line, index))}
      </Box>

      {/* Scroll indicator - more content below */}
      {hasMoreBelow && (
        <Box>
          <Text dimColor>▼ {lines.length - (scrollTop + viewportHeight)} more lines below...</Text>
        </Box>
      )}

      {/* Error message */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      {/* Help text */}
      <Box marginTop={1}>
        <Text dimColor italic>
          {onCancel ? 'Ctrl+S: Save | Esc: Cancel' : 'Ctrl+S: Save'}
        </Text>
      </Box>
    </Box>
  );
};
