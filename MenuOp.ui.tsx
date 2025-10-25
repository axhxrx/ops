import { Box, Text, useInput, useStdout } from 'ink';
import React, { useEffect, useMemo, useState } from 'react';
import type { Logger } from './Logger.ts';
import type { InfoPanel, LineContent, Menu, MenuItem } from './MenuPrimitives.ts';

/**
 * Props for InfoPanelView
 */
export interface InfoPanelViewProps
{
  panel: InfoPanel;
  backgroundColor?: string;
  padding?: number;
  terminalWidth?: number;
}

/**
 * InfoPanelView - Renders an InfoPanel with auto-layout
 *
 * Supports:
 * - Single text lines
 * - Column distribution (2 items = left/right, 3+ = distributed)
 * - Configurable left/right padding (defaults to 1)
 * - Full-width background
 */
export const InfoPanelView = ({
  panel,
  backgroundColor = 'blue',
  padding = 1,
  terminalWidth: providedWidth,
}: InfoPanelViewProps) =>
{
  const { stdout } = useStdout();

  // Use provided width if available, otherwise track our own (for standalone usage)
  const shouldTrackOwnWidth = providedWidth === undefined;

  const [terminalSize, setTerminalSize] = useState({
    width: stdout?.columns ?? 80,
    height: stdout?.rows ?? 24,
  });

  // Listen to resize events only if tracking our own width
  useEffect(() =>
  {
    if (!shouldTrackOwnWidth || !stdout) return;

    const handleResize = () =>
    {
      setTerminalSize({
        width: stdout.columns,
        height: stdout.rows,
      });
    };

    stdout.on('resize', handleResize);
    process.on('SIGWINCH', handleResize);

    return () =>
    {
      stdout.off('resize', handleResize);
      process.off('SIGWINCH', handleResize);
    };
  }, [stdout, shouldTrackOwnWidth]);

  const terminalWidth = providedWidth ?? terminalSize.width;

  const lines = panel.resolve();

  const renderLine = (content: LineContent, index: number) =>
  {
    const availableWidth = terminalWidth - (padding * 2);

    // Single string - just display it
    if (typeof content === 'string')
    {
      return (
        <Box key={index}>
          <Text>{content}</Text>
        </Box>
      );
    }

    // Array - distribute columns
    const columns = content;

    if (columns.length === 0)
    {
      return null;
    }

    if (columns.length === 1)
    {
      return (
        <Box key={index}>
          <Text>{columns[0]}</Text>
        </Box>
      );
    }

    if (columns.length === 2)
    {
      // Two columns: left and right aligned
      const [left, right] = columns;
      const leftWidth = left!.length;
      const rightWidth = right!.length;
      const spacing = Math.max(1, availableWidth - leftWidth - rightWidth);

      return (
        <Box key={index}>
          <Text>{left}</Text>
          <Text>{' '.repeat(spacing)}</Text>
          <Text>{right}</Text>
        </Box>
      );
    }

    // 3+ columns: distribute evenly
    const totalContentWidth = columns.reduce((sum, col) => sum + col.length, 0);
    const availableSpacing = Math.max(0, availableWidth - totalContentWidth);
    const spacingPerGap = Math.floor(availableSpacing / (columns.length - 1));

    return (
      <Box key={index}>
        {columns.map((col, colIndex) => (
          <Box key={colIndex}>
            <Text>{col}</Text>
            {colIndex < columns.length - 1 && <Text>{' '.repeat(spacingPerGap)}</Text>}
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box flexDirection='column' backgroundColor={backgroundColor} width={terminalWidth} paddingX={padding}>
      {lines.map((line, index) => renderLine(line, index))}
    </Box>
  );
};

/**
 * Props for MenuItemView
 */
export interface MenuItemViewProps<T extends string>
{
  item: MenuItem<T>;
  isHighlighted: boolean;
  helpColumnStart: number;
}

/**
 * MenuItemView - Renders a MenuItem with shortcut highlighting
 *
 * Features:
 * - Shortcut character highlighted with inverse/bold
 * - Help text dimmed
 * - Two-column layout (label | help)
 */
export const MenuItemView = <T extends string>({
  item,
  isHighlighted,
  helpColumnStart,
}: MenuItemViewProps<T>) =>
{
  const label = item.getDisplayLabel();
  const help = item.getHelp();
  const shortcutPos = item.getShortcutPosition();

  // Render label with shortcut highlighting
  // Note: If label contains ANSI codes (chalk styling), just render as-is
  // because we can't reliably find character positions in styled strings
  const renderLabel = () =>
  {
    // Check if label contains ANSI escape codes (starts with ESC character)
    // eslint-disable-next-line no-control-regex
    const hasAnsiCodes = /\x1b\[/.test(label);

    if (hasAnsiCodes || !shortcutPos)
    {
      return <Text>{label}</Text>;
    }

    const { char, index } = shortcutPos;
    const before = label.substring(0, index);
    const after = label.substring(index + 1);

    return (
      <Text>
        {before}
        <Text inverse bold>
          {char}
        </Text>
        {after}
      </Text>
    );
  };

  const labelLength = label.length;
  const spacing = Math.max(2, helpColumnStart - labelLength);

  return (
    <Box paddingX={2}>
      <Text color={isHighlighted ? 'cyan' : undefined} inverse={isHighlighted}>
        {isHighlighted ? '> ' : '  '}
      </Text>
      {renderLabel()}
      {help && (
        <>
          <Text>{' '.repeat(spacing)}</Text>
          <Text dimColor>{help}</Text>
        </>
      )}
    </Box>
  );
};

/**
 * Props for MenuView
 */
export interface MenuViewProps<T extends string>
{
  menu: Menu<T>;
  onSelect: (value: T) => void;
  onCancel?: () => void;
  logger?: Logger;
  fillHeight?: boolean;
}

/**
 * MenuView - The main menu component
 *
 * Features:
 * - Keyboard navigation (arrow keys, shortcuts)
 * - Header and footer panels
 * - Auto-layout and responsive design
 * - Optional full-height rendering (fills terminal to hide previous content)
 */
export const MenuView = <T extends string>({
  menu,
  onSelect,
  onCancel,
  logger,
  fillHeight = true,
}: MenuViewProps<T>) =>
{
  let handled = false;
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const { stdout } = useStdout();

  // Track terminal size with state to force re-renders on resize
  const [terminalSize, setTerminalSize] = useState({
    width: stdout?.columns ?? 80,
    height: stdout?.rows ?? 24,
  });

  // Set mounted flag after first render to fix Ink layout issues
  useEffect(() =>
  {
    setIsMounted(true);
  }, []);

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
    };

    stdout.on('resize', handleResize);
    process.on('SIGWINCH', handleResize);

    return () =>
    {
      stdout.off('resize', handleResize);
      process.off('SIGWINCH', handleResize);
    };
  }, [stdout]);

  const terminalHeight = terminalSize.height;
  const terminalWidth = terminalSize.width;

  // Detect if we're in split-pane mode (any item has details)
  const hasDetails = useMemo(() =>
  {
    return menu.items.some((item) => item.getDetails() !== undefined);
  }, [menu.items]);

  // Hide details pane if terminal is too narrow (< 80 cols)
  const showDetailPane = hasDetails && terminalWidth >= 80;

  // Calculate column widths with 25% minimums
  const columnWidths = useMemo(() =>
  {
    if (!showDetailPane)
    {
      // No split mode - use full width for menu
      const maxLabelLength = menu.items.reduce((max, item) =>
      {
        const label = item.getDisplayLabel();
        return Math.max(max, label.length);
      }, 0);

      return {
        menuPane: terminalWidth,
        helpColumnStart: maxLabelLength + 4,
        detailsPane: 0,
      };
    }

    // Split mode - calculate widths with minimums
    const detailsMinWidthPercent = menu.getDetailsMinWidth();
    const minWidthPerColumn = Math.floor(terminalWidth * 0.25); // 25% minimum

    // Reserve minimum for details pane
    const detailsPaneWidth = Math.max(
      minWidthPerColumn,
      Math.floor((terminalWidth * detailsMinWidthPercent) / 100),
    );

    // Menu pane gets the rest, but at least 25%
    const menuPaneWidth = Math.max(
      minWidthPerColumn,
      terminalWidth - detailsPaneWidth,
    );

    // Calculate help column start within menu pane
    const maxLabelLength = menu.items.reduce((max, item) =>
    {
      const label = item.getDisplayLabel();
      return Math.max(max, label.length);
    }, 0);

    const helpColumnStart = Math.min(
      maxLabelLength + 4,
      Math.floor(menuPaneWidth * 0.5), // Help text starts at most halfway through menu pane
    );

    return {
      menuPane: menuPaneWidth,
      helpColumnStart,
      detailsPane: detailsPaneWidth,
    };
  }, [showDetailPane, terminalWidth, menu]);

  // Calculate the starting column for help text
  // (find the longest label to align help text nicely)
  const helpColumnStart = columnWidths.helpColumnStart;

  // Get current highlighted item's details (memoized for performance)
  const currentDetails = useMemo(() =>
  {
    if (!showDetailPane) return null;
    const currentItem = menu.items[highlightedIndex];
    return currentItem?.getDetails() ?? null;
  }, [showDetailPane, menu.items, highlightedIndex]);

  // Calculate menu content height to determine spacer size (only if fillHeight is enabled)
  const header = menu.getHeader();
  const footer = menu.getFooter();

  let spacerHeight = 0;

  if (fillHeight && isMounted)
  {
    let contentHeight = 0;

    // Header height (lines + marginBottom, no top/bottom padding)
    if (header)
    {
      const headerLines = header.resolve().length;
      contentHeight += headerLines + 1; // +1 for marginBottom
    }

    // Content area height - always use menu items height
    // (Details pane will fill to match via internal spacer)
    contentHeight += menu.items.length;

    // Footer height (lines + marginTop, no top/bottom padding)
    if (footer)
    {
      const footerLines = footer.resolve().length;
      contentHeight += footerLines + 1; // +1 for marginTop
    }

    // Calculate remaining space to fill (subtract 1 to prevent pushing first line off-screen)
    spacerHeight = Math.max(0, terminalHeight - contentHeight - 1);
  }

  // Handle keyboard input
  useInput((input, key) =>
  {
    if (handled) return;

    // Escape to cancel
    if (key.escape && onCancel)
    {
      handled = true;
      logger?.log('Menu canceled');
      onCancel();
      return;
    }

    // Arrow up
    if (key.upArrow)
    {
      setHighlightedIndex((prev) => prev > 0 ? prev - 1 : menu.items.length - 1);
      return;
    }

    // Arrow down
    if (key.downArrow)
    {
      setHighlightedIndex((prev) => prev < menu.items.length - 1 ? prev + 1 : 0);
      return;
    }

    // Enter to select highlighted item
    if (key.return)
    {
      const selectedItem = menu.items[highlightedIndex];
      if (selectedItem)
      {
        handled = true;
        logger?.log(`Selected: ${selectedItem.value}`);
        onSelect(selectedItem.value);
      }
      return;
    }

    // Shortcut keys
    if (input)
    {
      const item = menu.findByShortcut(input);
      if (item)
      {
        handled = true;
        logger?.log(`Selected via shortcut '${input}': ${item.value}`);
        onSelect(item.value);
      }
    }
  });

  return (
    <Box flexDirection='column'>
      {/* Header */}
      {header && (
        <Box key='header' marginBottom={1}>
          <InfoPanelView
            panel={header}
            backgroundColor='blue'
            padding={header.getPadding()}
            terminalWidth={terminalWidth}
          />
        </Box>
      )}

      {/* Content area (menu items + optional details pane) */}
      {!showDetailPane ? (
        // Normal mode - no details pane
        <Box key='menu-items' flexDirection='column'>
          {menu.items.map((item, index) => (
            <MenuItemView
              key={item.value}
              item={item}
              isHighlighted={index === highlightedIndex}
              helpColumnStart={helpColumnStart}
            />
          ))}
        </Box>
      ) : (
        // Split-pane mode
        <Box key='content-area' flexDirection='row'>
          {/* Left: Menu items */}
          <Box flexDirection='column' width={columnWidths.menuPane}>
            {menu.items.map((item, index) => (
              <MenuItemView
                key={item.value}
                item={item}
                isHighlighted={index === highlightedIndex}
                helpColumnStart={helpColumnStart}
              />
            ))}
          </Box>

          {/* Right: Details pane (separator inside, fills full height) */}
          <Box
            flexDirection='column'
            width={columnWidths.detailsPane}
            backgroundColor='blackBright'
            paddingX={1}
          >
            {/* TODO: Handle scrolling when info pane is too tall */}
            {(() =>
            {
              // Details pane should fill to match content area height
              // Content area = entire space from header to footer
              let contentAreaHeight = terminalHeight;
              if (header)
              {
                contentAreaHeight -= header.resolve().length + 1; // +1 for marginBottom
              }
              if (footer)
              {
                contentAreaHeight -= footer.resolve().length + 1; // +1 for marginTop
              }
              contentAreaHeight -= 1; // Subtract 1 for safety

              const detailsLines = currentDetails ? currentDetails.resolve() : [];
              const allLines: React.JSX.Element[] = [];

              // Log for debugging
              // if (typeof logger !== 'undefined' && logger)
              // {
              //   logger.log(`Details pane height calculation:`);
              //   logger.log(`  terminalHeight: ${terminalHeight}`);
              //   logger.log(`  header lines: ${header ? header.resolve().length : 0}`);
              //   logger.log(`  footer lines: ${footer ? footer.resolve().length : 0}`);
              //   logger.log(`  contentAreaHeight: ${contentAreaHeight}`);
              //   logger.log(`  menu items: ${menu.items.length}`);
              //   logger.log(`  details lines (unwrapped): ${detailsLines.length}`);
              // }

              // Helper: Wrap text to fit width
              const wrapText = (text: string, maxWidth: number): string[] =>
              {
                const words = text.split(' ');
                const lines: string[] = [];
                let currentLine = '';

                for (const word of words)
                {
                  const testLine = currentLine ? `${currentLine} ${word}` : word;
                  if (testLine.length <= maxWidth)
                  {
                    currentLine = testLine;
                  }
                  else
                  {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                  }
                }
                if (currentLine) lines.push(currentLine);
                return lines.length > 0 ? lines : [''];
              };

              // Render actual details content with "│ " prefix
              detailsLines.forEach((line, index) =>
              {
                const availableWidth = columnWidths.detailsPane - 4; // Account for paddingX + "│ " prefix

                // Single string - wrap it and render each wrapped line
                if (typeof line === 'string')
                {
                  const wrappedLines = wrapText(line, availableWidth);
                  wrappedLines.forEach((wrappedLine, wrapIndex) =>
                  {
                    allLines.push(
                      <Box key={`details-line-${index}-${wrapIndex}`}>
                        <Text dimColor>│ </Text>
                        <Text>{wrappedLine}</Text>
                      </Box>,
                    );
                  });
                  return;
                }

                // Array - distribute columns (same logic as InfoPanelView)
                const columns = line;
                if (columns.length === 0) return;

                if (columns.length === 1)
                {
                  allLines.push(
                    <Box key={`details-line-${index}`}>
                      <Text dimColor>│ </Text>
                      <Text>{columns[0]}</Text>
                    </Box>,
                  );
                  return;
                }

                if (columns.length === 2)
                {
                  const [left, right] = columns;
                  const leftWidth = left!.length;
                  const rightWidth = right!.length;
                  const spacing = Math.max(1, availableWidth - leftWidth - rightWidth);

                  allLines.push(
                    <Box key={`details-line-${index}`}>
                      <Text dimColor>│ </Text>
                      <Text>{left}</Text>
                      <Text>{' '.repeat(spacing)}</Text>
                      <Text>{right}</Text>
                    </Box>,
                  );
                  return;
                }

                // 3+ columns: distribute evenly
                const totalContentWidth = columns.reduce((sum, col) => sum + col.length, 0);
                const availableSpacing = Math.max(0, availableWidth - totalContentWidth);
                const spacingPerGap = Math.floor(availableSpacing / (columns.length - 1));

                allLines.push(
                  <Box key={`details-line-${index}`}>
                    <Text dimColor>│ </Text>
                    {columns.map((col, colIndex) => (
                      <Box key={`details-col-${index}-${colIndex}`}>
                        <Text>{col}</Text>
                        {colIndex < columns.length - 1 && <Text>{' '.repeat(spacingPerGap)}</Text>}
                      </Box>
                    ))}
                  </Box>,
                );
              });

              // Fill remaining lines with "│ " to reach contentAreaHeight
              // Use allLines.length (actual rendered lines) not detailsLines.length (unwrapped lines)
              const remainingLines = Math.max(0, contentAreaHeight - allLines.length);

              // Log remaining lines calculation
              // if (typeof logger !== 'undefined' && logger)
              // {
              //   logger.log(`  wrapped lines rendered: ${allLines.length}`);
              //   logger.log(`  remaining filler lines: ${remainingLines}`);
              // }

              for (let i = 0; i < remainingLines; i++)
              {
                allLines.push(
                  <Box key={`details-empty-${i}`}>
                    <Text dimColor>│ </Text>
                  </Box>,
                );
              }

              return <>{allLines}</>;
            })()}
          </Box>
        </Box>
      )}

      {/* Spacer to push footer to bottom (not needed in split mode - details pane fills height) */}
      {!showDetailPane && spacerHeight > 0 && <Box key='spacer-bottom' height={spacerHeight} />}

      {/* Footer (anchored to bottom) */}
      {footer && (
        <Box key='footer' marginTop={1}>
          <InfoPanelView
            panel={footer}
            backgroundColor='gray'
            padding={footer.getPadding()}
            terminalWidth={terminalWidth}
          />
        </Box>
      )}

      {/* Help text */}
      {
        /*<Box marginTop={1} paddingX={2}>
        <Text dimColor italic>
          {onCancel ? '↑↓: Navigate | Enter: Select | Esc: Cancel' : '↑↓: Navigate | Enter: Select'}
        </Text>
      </Box>*/
      }
    </Box>
  );
};
