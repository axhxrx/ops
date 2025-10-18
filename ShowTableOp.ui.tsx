import { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { Logger } from './Logger';
import type {
  ShowTableOpOptions,
  TableColumn,
  TableData,
  TableDataProvider,
  TableRow,
} from './ShowTableOp';

/**
 Props for TableView component
 */
export interface TableViewProps<T = Record<string, string | number | boolean>>
{
  /**
   Table options including mode, data provider, etc.
   */
  options: ShowTableOpOptions<T>;

  /**
   Callback when user selects a row (select-row mode)
   */
  onSelect?: (row: TableRow<T>) => void;

  /**
   Callback when user confirms multi-selection (select-multi mode)
   */
  onSelectMulti?: (rows: TableRow<T>[]) => void;

  /**
   Callback when user cancels (if cancelable is true)
   */
  onCancel?: () => void;

  /**
   Callback when user exits display mode
   */
  onExit?: () => void;

  /**
   Error/validation message to display (replaces help text when set)
   */
  errorMessage?: string | null;

  /**
   Optional logger for debug output
   */
  logger?: Logger;
}

/**
 TableView - Interactive table display component

 Features:
 - Keyboard navigation (arrows, Home, End, PgUp, PgDn)
 - Row highlighting
 - Single/multi-select modes
 - Dynamic data with polling
 - Help text area with fixed height
 - Responsive column sizing

 @example
 ```tsx
 <TableView
   options={{
     mode: 'select-row',
     dataProvider: tableData,
     cancelable: true
   }}
   onSelect={(row) => console.log('Selected:', row)}
   onCancel={() => console.log('Canceled')}
 />
 ```
 */
export const TableView = <T extends Record<string, string | number | boolean>>(
  { options, onSelect, onSelectMulti, onCancel, onExit, errorMessage: externalError, logger }: TableViewProps<T>,
) =>
{
  const mode = options.mode ?? 'display';

  // Get terminal dimensions
  const { stdout } = useStdout();

  // Track terminal size with state to force re-renders on resize
  const [terminalSize, setTerminalSize] = useState({
    width: stdout?.columns ?? 80,
    height: stdout?.rows ?? 24,
  });

  // Listen to resize events manually (Bun/Ink compatibility workaround)
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

    // Listen to resize event on stdout
    stdout.on('resize', handleResize);

    // Also listen to SIGWINCH for better compatibility
    process.on('SIGWINCH', handleResize);

    // Cleanup
    return () =>
    {
      stdout.off('resize', handleResize);
      process.off('SIGWINCH', handleResize);
    };
  }, [stdout, logger]);

  const terminalWidth = terminalSize.width;
  const terminalHeight = terminalSize.height;

  // State for current data
  const [data, setData] = useState<TableData<T> | null>(null);

  // State for highlighted row index
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // State for viewport scroll position (top row index being displayed)
  const [scrollTop, setScrollTop] = useState(0);

  // State for selected rows (multi-select mode)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // State for dismissing external errors
  const [errorDismissed, setErrorDismissed] = useState(false);

  // Show error only if not dismissed
  const errorMessage = (externalError && !errorDismissed) ? externalError : null;

  // Track if we've already handled the action
  let handled = false;

  // Load initial data
  useEffect(() =>
  {
    const loadData = async () =>
    {
      try
      {
        const result = typeof options.dataProvider === 'function'
          ? await options.dataProvider()
          : options.dataProvider;

        setData(result);
      }
      catch (error: unknown)
      {
        logger?.error(`Failed to load table data: ${String(error)}`);
      }
    };

    void loadData();
  }, [options.dataProvider, logger]);

  // Set up polling if enabled
  useEffect(() =>
  {
    if (typeof options.dataProvider !== 'function' || !options.pollIntervalMs)
    {
      return;
    }

    const interval = setInterval(() =>
    {
      void (async () =>
      {
        try
        {
          const result = await (options.dataProvider as TableDataProvider<T>)();
          setData(result);
        }
        catch (error: unknown)
        {
          logger?.error(`Failed to poll table data: ${String(error)}`);
        }
      })();
    }, options.pollIntervalMs);

    return () => clearInterval(interval);
  }, [options.dataProvider, options.pollIntervalMs, logger]);

  // Calculate max help text lines for fixed height
  const maxHelpTextLines = data
    ? data.rows.reduce((max, row) =>
    {
      if (!row.helpText) return max;
      const lines = row.helpText.split('\n').length;
      return Math.max(max, lines);
    }, 0)
    : 0;

  // Get current help text
  const currentHelpText = data?.rows[highlightedIndex]?.helpText;

  // Calculate how many rows can fit in the viewport
  const calculateViewportHeight = (): number =>
  {
    if (!data) return 10;

    // Calculate space used by UI elements:
    // - Title: 2 lines (1 for title + 1 for margin)
    // - Header: 1 line
    // - Header separator: 2 lines (1 for separator + 1 for margin)
    // - Help text: maxHelpTextLines + 3 (border + margin)
    // - Shortcuts: 2 lines (1 for shortcuts + 1 for margin)
    let usedLines = 0;

    if (options.title) usedLines += 2;
    usedLines += 1; // header
    usedLines += 2; // separator + margin

    if (maxHelpTextLines > 0)
    {
      usedLines += maxHelpTextLines + 3; // help box with borders
    }

    usedLines += 2; // shortcuts
    usedLines += 2; // buffer for safety

    const availableLines = terminalHeight - usedLines;
    return Math.max(3, availableLines); // Minimum 3 rows visible
  };

  // Handle keyboard input
  useInput((input, key) =>
  {
    if (handled || !data || data.rows.length === 0) return;

    // If there's an error showing, dismiss it on any key and consume the keypress
    if (errorMessage)
    {
      setErrorDismissed(true);
      logger?.log('Error message dismissed');
      return; // Consume the keypress
    }

    // Handle Escape
    if (key.escape && onCancel && mode !== 'display')
    {
      handled = true;
      logger?.log('Escape pressed - canceling');
      onCancel();
      return;
    }

    // Handle any key in display mode to exit
    if (mode === 'display' && onExit)
    {
      handled = true;
      logger?.log('Key pressed in display mode - exiting');
      onExit();
      return;
    }

    // Arrow Up
    if (key.upArrow)
    {
      setHighlightedIndex((prev) =>
      {
        const newIndex = prev > 0 ? prev - 1 : data.rows.length - 1;
        // Auto-scroll viewport if needed
        setScrollTop((currentScroll) =>
        {
          // If we wrapped around to the bottom, scroll to show the last row
          if (prev === 0 && newIndex === data.rows.length - 1)
          {
            const viewportHeight = calculateViewportHeight();
            return Math.max(0, data.rows.length - viewportHeight);
          }
          // If new index is above viewport, scroll up to show it
          if (newIndex < currentScroll)
          {
            return newIndex;
          }
          return currentScroll;
        });
        return newIndex;
      });
      return;
    }

    // Arrow Down
    if (key.downArrow)
    {
      setHighlightedIndex((prev) =>
      {
        const newIndex = prev < data.rows.length - 1 ? prev + 1 : 0;
        // Auto-scroll viewport if needed
        setScrollTop((currentScroll) =>
        {
          const viewportHeight = calculateViewportHeight();
          if (newIndex >= currentScroll + viewportHeight)
          {
            return newIndex - viewportHeight + 1;
          }
          if (newIndex === 0)
          {
            return 0;
          }
          return currentScroll;
        });
        return newIndex;
      });
      return;
    }

    // Home (h key)
    if (input === 'h')
    {
      setHighlightedIndex(0);
      setScrollTop(0);
      return;
    }

    // End (e key)
    if (input === 'e')
    {
      setHighlightedIndex(data.rows.length - 1);
      const viewportHeight = calculateViewportHeight();
      setScrollTop(Math.max(0, data.rows.length - viewportHeight));
      return;
    }

    // Page Up
    if (key.pageUp)
    {
      setHighlightedIndex((prev) =>
      {
        const viewportHeight = calculateViewportHeight();
        const newIndex = Math.max(0, prev - viewportHeight);
        setScrollTop(Math.max(0, newIndex));
        return newIndex;
      });
      return;
    }

    // Page Down
    if (key.pageDown)
    {
      setHighlightedIndex((prev) =>
      {
        const viewportHeight = calculateViewportHeight();
        const newIndex = Math.min(data.rows.length - 1, prev + viewportHeight);
        setScrollTop(Math.max(0, Math.min(newIndex, data.rows.length - viewportHeight)));
        return newIndex;
      });
      return;
    }

    // Space - toggle selection in multi-select mode
    if (input === ' ' && mode === 'select-multi')
    {
      setSelectedIndices((prev) =>
      {
        const newSet = new Set(prev);
        if (newSet.has(highlightedIndex))
        {
          newSet.delete(highlightedIndex);
          logger?.log(`Deselected row ${highlightedIndex}`);
        }
        else
        {
          newSet.add(highlightedIndex);
          logger?.log(`Selected row ${highlightedIndex}`);
        }
        return newSet;
      });
      return;
    }

    // Enter - confirm selection
    if (key.return)
    {
      if (mode === 'select-row' && onSelect)
      {
        const selectedRow = data.rows[highlightedIndex];
        if (selectedRow && (selectedRow.selectable ?? true))
        {
          handled = true;
          logger?.log(`Row selected: ${highlightedIndex}`);
          onSelect(selectedRow);
        }
      }
      else if (mode === 'select-multi' && onSelectMulti)
      {
        const selectedRows = Array.from(selectedIndices)
          .map((idx) => data.rows[idx])
          .filter((row): row is TableRow<T> => row !== undefined);
        handled = true;
        logger?.log(`Multi-select confirmed: ${selectedIndices.size} rows`);
        onSelectMulti(selectedRows);
      }
    }
  });

  // If no data loaded yet, show loading
  if (!data)
  {
    return (
      <Box flexDirection="column">
        <Text dimColor>Loading...</Text>
      </Box>
    );
  }

  // Calculate column widths with terminal width constraints
  const calculateColumnWidths = (columns: TableColumn[], rows: TableRow<T>[]) =>
  {
    const widths: Record<string, number> = {};
    const actualContentWidths: Record<string, number> = {};

    // Calculate ideal widths AND actual content widths
    for (const col of columns)
    {
      // Start with specified width or header length
      let maxWidth = col.width ?? col.label.length;
      let actualMaxWidth = col.label.length;

      // Check all row data for this column to find actual content width
      for (const row of rows)
      {
        const value = row.data[col.key];
        const valueStr = value?.toString() ?? '';
        actualMaxWidth = Math.max(actualMaxWidth, valueStr.length);
        if (!col.width)
        {
          maxWidth = Math.max(maxWidth, valueStr.length);
        }
      }

      widths[col.key] = maxWidth;
      actualContentWidths[col.key] = actualMaxWidth;
    }

    // Calculate total width needed (including spacing)
    const multiSelectPadding = mode === 'select-multi' ? 4 : 0; // [✓] + space
    const columnSpacing = (columns.length - 1) * 2; // 2 spaces between columns
    const totalCurrentWidth = Object.values(widths).reduce((sum, w) => sum + w, 0)
      + columnSpacing
      + multiSelectPadding;

    // Use more conservative margin to prevent wrapping
    const availableWidth = terminalWidth - 10; // Leave generous margin

    if (totalCurrentWidth > availableWidth)
    {
      // SHRINK: Table is too wide, proportionally shrink columns
      const shrinkFactor = availableWidth / totalCurrentWidth;

      for (const col of columns)
      {
        const idealWidth = widths[col.key] ?? col.label.length;
        widths[col.key] = Math.max(3, Math.floor(idealWidth * shrinkFactor));
      }
    }
    else if (totalCurrentWidth < availableWidth)
    {
      // EXPAND: We have extra space! Distribute to columns that need it
      const extraSpace = availableWidth - totalCurrentWidth;

      // Find columns that could use more space (where content > current width)
      const expandableColumns = columns.filter((col) =>
      {
        const currentWidth = widths[col.key] ?? 0;
        const contentWidth = actualContentWidths[col.key] ?? 0;
        return contentWidth > currentWidth;
      });

      if (expandableColumns.length > 0)
      {
        // Distribute extra space to expandable columns
        const spacePerColumn = Math.floor(extraSpace / expandableColumns.length);

        for (const col of expandableColumns)
        {
          const currentWidth = widths[col.key] ?? 0;
          const contentWidth = actualContentWidths[col.key] ?? 0;
          // Expand up to actual content width, but not more than our share of extra space
          widths[col.key] = Math.min(contentWidth, currentWidth + spacePerColumn);
        }
      }
    }

    return widths;
  };

  const columnWidths = calculateColumnWidths(data.columns, data.rows);

  // Format cell value with alignment and truncation
  const formatCell = (value: string | number | boolean | undefined, column: TableColumn) =>
  {
    const str = value?.toString() ?? '';
    const width = columnWidths[column.key] ?? column.label.length;
    const align = column.align ?? 'left';

    // For very narrow columns, just show ellipsis if content doesn't fit
    if (width <= 4)
    {
      if (str.length > width)
      {
        return '…'.padEnd(width, ' ');
      }
      return str.padEnd(width, ' ');
    }

    // Truncate if too long (leaving room for ellipsis)
    let displayStr = str;
    if (str.length > width)
    {
      // Leave room for ellipsis
      displayStr = str.substring(0, width - 1) + '…';
    }

    // Apply alignment
    if (align === 'right')
    {
      return displayStr.padStart(width, ' ');
    }
    else if (align === 'center')
    {
      const totalPadding = width - displayStr.length;
      const leftPadding = Math.floor(totalPadding / 2);
      const rightPadding = totalPadding - leftPadding;
      return ' '.repeat(leftPadding) + displayStr + ' '.repeat(rightPadding);
    }
    else
    {
      return displayStr.padEnd(width, ' ');
    }
  };

  // Render help text area (or error message overlay)
  const renderHelpText = () =>
  {
    if (maxHelpTextLines === 0 && !errorMessage)
    {
      return null;
    }

    // If there's an error, show it instead of help text
    if (errorMessage)
    {
      const errorLines = errorMessage.split('\n');
      const minHeight = Math.max(3, maxHelpTextLines); // At least 3 lines for error
      const paddingLines = Math.max(0, minHeight - errorLines.length);

      return (
        <Box flexDirection="column" marginTop={1} borderStyle="bold" borderColor="red" paddingX={1}>
          <Box flexDirection="column" backgroundColor="red">
            <Text bold color="black">
              ⚠️  {errorMessage}
            </Text>
          </Box>
          {/* Add padding lines to maintain consistent height */}
          {Array.from({ length: paddingLines }).map((_, i) => (
            <Text key={`error-padding-${i}`}> </Text>
          ))}
          <Box marginTop={1}>
            <Text dimColor italic>
              Press any key to dismiss
            </Text>
          </Box>
        </Box>
      );
    }

    // Normal help text display
    const currentLines = currentHelpText ? currentHelpText.split('\n') : [];
    const paddingLines = maxHelpTextLines - currentLines.length;

    return (
      <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        {currentHelpText
          ? <Text dimColor>{currentHelpText}</Text>
          : <Text dimColor italic>No help text available</Text>}
        {/* Add empty lines to maintain fixed height */}
        {Array.from({ length: paddingLines }).map((_, i) => (
          <Text key={`padding-${i}`}> </Text>
        ))}
      </Box>
    );
  };

  // Render keyboard shortcuts hint (hide when error is showing)
  const renderShortcuts = () =>
  {
    // Don't show shortcuts when error is displayed
    if (errorMessage)
    {
      return null;
    }

    if (mode === 'display')
    {
      return <Text dimColor italic>Press any key to close</Text>;
    }

    const shortcuts: string[] = [];
    shortcuts.push('↑↓: Navigate');

    if (mode === 'select-multi')
    {
      shortcuts.push('Space: Toggle');
    }

    shortcuts.push('Enter: Select');

    if (onCancel)
    {
      shortcuts.push('Esc: Cancel');
    }

    return <Text dimColor italic>{shortcuts.join(' | ')}</Text>;
  };


  // Check if terminal is too small
  const MIN_WIDTH = 50;
  const MIN_HEIGHT = 12;

  // Only show warning if we have real terminal size (not defaults)
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

  // Calculate viewport
  const viewportHeight = calculateViewportHeight();
  const visibleRows = data ? data.rows.slice(scrollTop, scrollTop + viewportHeight) : [];
  const hasMoreAbove = scrollTop > 0;
  const hasMoreBelow = data ? scrollTop + viewportHeight < data.rows.length : false;

  // Calculate fillHeight spacer (similar to MenuOp)
  const fillHeight = options.fillHeight ?? true;
  let spacerHeight = 0;

  if (fillHeight && data)
  {
    let contentHeight = 0;

    // Title (if present)
    if (options.title)
    {
      contentHeight += 2; // 1 line + marginBottom
    }

    // Table header + separator
    contentHeight += 2; // header row + separator row

    // Visible rows
    contentHeight += visibleRows.length;

    // Scroll indicators
    if (hasMoreAbove) contentHeight += 1;
    if (hasMoreBelow) contentHeight += 1;

    // Help text area (approximate height of the box)
    const helpTextLines = errorMessage ? 8 : (data.rows[highlightedIndex]?.helpText ? 8 : 0);
    contentHeight += helpTextLines;

    // Keyboard shortcuts
    contentHeight += 2; // marginTop + 1 line

    // Calculate remaining space to fill (subtract 1 to prevent pushing first line off-screen)
    spacerHeight = Math.max(0, terminalHeight - contentHeight - 1);
  }

  return (
    <Box flexDirection="column">
      {/* Title */}
      {options.title && (
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {options.title}
          </Text>
        </Box>
      )}

      {/* Table Header */}
      <Box>
        {mode === 'select-multi' && <Text dimColor>   </Text>}
        {data.columns.map((col, idx) => (
          <Box key={col.key} width={columnWidths[col.key]} marginRight={idx < data.columns.length - 1 ? 2 : 0}>
            <Text bold color="blue">
              {formatCell(col.label, col)}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Header separator */}
      <Box marginBottom={1}>
        <Text dimColor>
          {mode === 'select-multi' && '   '}
          {data.columns.map((col, idx) =>
            '─'.repeat(columnWidths[col.key]!) + (idx < data.columns.length - 1 ? '  ' : '')
          ).join('')}
        </Text>
      </Box>

      {/* Scroll indicator - more content above */}
      {hasMoreAbove && (
        <Box marginBottom={0}>
          <Text dimColor>▲ {scrollTop} more above...</Text>
        </Box>
      )}

      {/* Table Rows (viewport) */}
      {data.rows.length === 0
        ? (
            <Box>
              <Text dimColor italic>No data to display</Text>
            </Box>
          )
        : visibleRows.map((row, viewportIdx) =>
        {
          const rowIdx = scrollTop + viewportIdx;
          const isHighlighted = rowIdx === highlightedIndex;
          const isSelected = selectedIndices.has(rowIdx);
          const isSelectable = row.selectable ?? true;

          return (
            <Box key={rowIdx}>
              {/* Multi-select checkbox */}
              {mode === 'select-multi' && (
                <Text color={isHighlighted ? 'cyan' : undefined}>
                  {isSelected ? '[✓]' : '[ ]'}
                </Text>
              )}

              {/* Row cells */}
              {data.columns.map((col, colIdx) =>
              {
                const value = row.data[col.key];
                const formattedValue = formatCell(value, col);

                return (
                  <Box
                    key={col.key}
                    width={columnWidths[col.key]}
                    marginRight={colIdx < data.columns.length - 1 ? 2 : 0}
                  >
                    <Text
                      color={isHighlighted ? 'cyan' : row.metadata?.color}
                      inverse={isHighlighted}
                      dimColor={row.metadata?.dimmed || !isSelectable}
                    >
                      {formattedValue}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          );
        })}

      {/* Scroll indicator - more content below */}
      {hasMoreBelow && (
        <Box marginTop={0}>
          <Text dimColor>▼ {data.rows.length - (scrollTop + viewportHeight)} more below...</Text>
        </Box>
      )}

      {/* Spacer to push help text and shortcuts to bottom */}
      {spacerHeight > 0 && <Box key='spacer-bottom' height={spacerHeight} />}

      {/* Help text area */}
      {renderHelpText()}

      {/* Keyboard shortcuts */}
      <Box marginTop={1}>
        {renderShortcuts()}
      </Box>
    </Box>
  );
};
