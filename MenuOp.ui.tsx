import { Box, Text, useInput, useStdout } from 'ink';
import { useEffect, useState } from 'react';
import type { Logger } from './Logger';
import type { InfoPanel, LineContent, Menu, MenuItem } from './MenuPrimitives';

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

  // Calculate the starting column for help text
  // (find the longest label to align help text nicely)
  const maxLabelLength = menu.items.reduce((max, item) =>
  {
    const label = item.getDisplayLabel();
    return Math.max(max, label.length);
  }, 0);
  const helpColumnStart = maxLabelLength + 4; // Add some spacing

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

    // Menu items height
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

      {/* Menu Items */}
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

      {/* Footer */}
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

      {/* Spacer at bottom to fill remaining vertical space */}
      {spacerHeight > 0 && <Box key='spacer-bottom' height={spacerHeight} />}

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
