import { Box, Text, useInput, useStdout } from 'ink';
import { useEffect, useState } from 'react';
import type { Logger } from './Logger.ts';

/**
 * Matrix rain background - falling characters with cyberpunk vibes
 */
export const MatrixRain = ({ animate }: { animate: boolean }) =>
{
  const { stdout } = useStdout();
  const [drops, setDrops] = useState<string[][]>([]);

  const width = stdout?.columns ?? 80;
  const height = stdout?.rows ?? 24;

  // Initialize matrix rain columns
  useEffect(() =>
  {
    const columns = Math.floor(width / 2); // Space them out
    const initialDrops: string[][] = [];

    for (let i = 0; i < columns; i++)
    {
      const columnDrops: string[] = [];
      const dropHeight = Math.floor(Math.random() * height);

      for (let j = 0; j < dropHeight; j++)
      {
        // Random chars: katakana, numbers, symbols
        const chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ0123456789@#$%^&*';
        columnDrops.push(chars[Math.floor(Math.random() * chars.length)]!);
      }
      initialDrops.push(columnDrops);
    }

    setDrops(initialDrops);

    if (!animate) return;

    // Animate the rain
    const interval = setInterval(() =>
    {
      setDrops((prev) =>
      {
        return prev.map((column) =>
        {
          // Randomly add new drop at top or remove from bottom
          if (Math.random() > 0.95 && column.length < height)
          {
            const chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ0123456789@#$%^&*';
            return [chars[Math.floor(Math.random() * chars.length)]!, ...column];
          }
          if (Math.random() > 0.98 && column.length > 0)
          {
            return column.slice(0, -1);
          }
          return column;
        });
      });
    }, 100);

    return () => clearInterval(interval);
  }, [width, height, animate]);

  // Render the matrix rain as background
  const lines: string[] = [];
  for (let y = 0; y < height; y++)
  {
    let line = '';
    for (let x = 0; x < drops.length; x++)
    {
      const drop = drops[x];
      if (drop && y < drop.length)
      {
        line += drop[y];
      }
      else
      {
        line += ' ';
      }
      line += ' '; // Spacing between columns
    }
    lines.push(line);
  }

  return (
    <Box flexDirection='column' width={width} height={height}>
      {lines.map((line, i) => (
        <Text key={`matrix-line-${i}`} color='green' dimColor>
          {line}
        </Text>
      ))}
    </Box>
  );
};

/**
 * Props for ModalDialog
 */
export interface ModalDialogProps
{
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'green' | 'red' | 'yellow' | 'magenta';
  cancelColor?: 'green' | 'red' | 'yellow' | 'magenta';
  onConfirm: () => void;
  onCancel?: () => void;
  logger?: Logger;
}

/**
 * Brutalist 8-bit button with drop shadow (only when selected)
 * Both focused and unfocused render with same structure to prevent movement
 */
const Button = ({
  label,
  selected,
  color,
  minWidth = 10, // Minimum width (default matches "Cancel" button)
}: {
  label: string;
  selected: boolean;
  color: 'green' | 'red' | 'yellow' | 'magenta';
  minWidth?: number;
}) =>
{
  const buttonWidth = Math.max(label.length + 4, minWidth);
  const buttonHeight = 3;
  const shadowChar = '░';

  // Always render the same structure - just make shadow invisible when not selected
  return (
    <Box flexDirection='row'>
      <Box flexDirection='column'>
        {/* Button */}
        <Box
          width={buttonWidth}
          height={buttonHeight}
          backgroundColor={selected ? color : 'gray'}
          justifyContent='center'
          alignItems='center'
          marginRight={0}
        >
          <Text bold={selected} color='black'>
            {label}
          </Text>
        </Box>

        {/* Bottom shadow row (offset 1 right) - invisible when not selected */}
        <Box>
          <Text color={selected ? 'blackBright' : 'cyan'}>
            {' ' + (selected ? shadowChar.repeat(buttonWidth + 2) : ' '.repeat(buttonWidth + 2))}
          </Text>
        </Box>
      </Box>

      {/* Shadow to the right (2 chars wide) - invisible when not selected */}
      <Box flexDirection='column' marginLeft={0} paddingLeft={0}>
        {Array.from({ length: buttonHeight }).map((_, i) => (
          <Text key={`button-shadow-${i}`} color={selected ? 'blackBright' : 'cyan'}>
            {selected ? shadowChar.repeat(1) : ' '}
          </Text>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Cyberpunk modal dialog - brutalist with drop shadow
 */
export const ModalDialog = ({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  confirmColor = 'green',
  cancelColor = 'red',
  onConfirm,
  onCancel,
  logger,
}: ModalDialogProps) =>
{
  const { stdout } = useStdout();
  const [selectedButton, setSelectedButton] = useState<'confirm' | 'cancel'>('confirm');

  const termWidth = stdout?.columns ?? 80;
  const termHeight = stdout?.rows ?? 24;

  // Handle keyboard input
  let handled = false;
  useInput((input, key) =>
  {
    if (handled) return;

    // Tab to switch buttons
    if (key.tab && onCancel)
    {
      setSelectedButton((prev) => (prev === 'confirm' ? 'cancel' : 'confirm'));
      return;
    }

    // Arrow keys to switch buttons
    if ((key.leftArrow || key.rightArrow) && onCancel)
    {
      setSelectedButton((prev) => (prev === 'confirm' ? 'cancel' : 'confirm'));
      return;
    }

    // Enter to confirm selected button
    if (key.return)
    {
      handled = true;
      if (selectedButton === 'confirm')
      {
        logger?.log('Modal confirmed');
        onConfirm();
      }
      else if (onCancel)
      {
        logger?.log('Modal canceled');
        onCancel();
      }
      return;
    }

    // Escape to cancel
    if (key.escape && onCancel)
    {
      handled = true;
      logger?.log('Modal canceled (Esc)');
      onCancel();
      return;
    }

    // Direct shortcuts
    if (input === 'y' || input === 'Y')
    {
      handled = true;
      logger?.log('Modal confirmed (Y)');
      onConfirm();
      return;
    }

    if ((input === 'n' || input === 'N') && onCancel)
    {
      handled = true;
      logger?.log('Modal canceled (N)');
      onCancel();
    }
  });

  // Calculate modal dimensions
  const modalWidth = Math.min(60, termWidth - 4);
  const _modalHeight = Math.min(20, termHeight - 4);

  // Wrap message text to fit modal width
  const messageWidth = modalWidth - 6; // Account for padding and borders
  const wrappedMessage = message
    .split('\n')
    .flatMap((line) =>
    {
      const words = line.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words)
      {
        if ((currentLine + ' ' + word).length <= messageWidth)
        {
          currentLine += (currentLine ? ' ' : '') + word;
        }
        else
        {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    });

  // Calculate modal content height
  const titleHeight = 2; // Title + margin
  const messageHeight = wrappedMessage.length + 1; // Message + margin
  const buttonsHeight = 5; // Buttons + gap
  const contentHeight = titleHeight + messageHeight + buttonsHeight;

  return (
    <Box
      flexDirection='column'
      alignItems='center'
      justifyContent='center'
      width={termWidth}
      height={termHeight}
      position='absolute'
    >
      <Box flexDirection='column'>
        <Box>
          {/* Modal box */}
          <Box
            flexDirection='column'
            width={modalWidth + 4}
            backgroundColor='cyan'
            paddingX={2}
            paddingY={1}
          >
            {/* Title */}
            <Box justifyContent='center' marginBottom={1}>
              <Text bold color='black'>
                ▓▒░ {title.toUpperCase()} ░▒▓
              </Text>
            </Box>

            {/* Message */}
            <Box flexDirection='column' marginBottom={1}>
              {wrappedMessage.map((line, i) => (
                <Text key={`message-line-${i}`} color='black'>
                  {line}
                </Text>
              ))}
            </Box>

            {/* Buttons */}
            <Box justifyContent='center' flexDirection='row'>
              <Button
                label={confirmLabel}
                selected={selectedButton === 'confirm'}
                color={confirmColor}
                minWidth={onCancel
                  ? Math.max(confirmLabel.length + 4, cancelLabel.length + 4)
                  : confirmLabel.length + 4}
              />

              {onCancel && (
                <>
                  <Text></Text>
                  <Button
                    label={cancelLabel}
                    selected={selectedButton === 'cancel'}
                    color={cancelColor}
                    minWidth={Math.max(confirmLabel.length + 4, cancelLabel.length + 4)}
                  />
                </>
              )}
            </Box>
          </Box>

          {/* Drop shadow (1 char right, vertical bar) - using glitch char */}
          <Box flexDirection='column'>
            {Array.from({ length: contentHeight }).map((_, i) => (
              <Text key={`modal-shadow-${i}`} color='blackBright'>
                ░
              </Text>
            ))}
          </Box>
        </Box>

        {/* Drop shadow (1 char down, horizontal bar) - using glitch chars, offset 1 right */}
        <Box>
          <Text color='blackBright'>{' ' + '░'.repeat(modalWidth + 5)}</Text>
        </Box>
      </Box>
    </Box>
  );
};

/**
 * Props for ModalView
 */
export interface ModalViewProps
{
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'green' | 'red' | 'yellow' | 'magenta';
  cancelColor?: 'green' | 'red' | 'yellow' | 'magenta';
  showCancel?: boolean;
  animate?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  logger?: Logger;
}

/**
 * Full-screen modal with Matrix rain background
 */
export const ModalView = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmColor,
  cancelColor,
  showCancel = true,
  animate = true,
  onConfirm,
  onCancel,
  logger,
}: ModalViewProps) =>
{
  return (
    <Box>
      {/* Matrix rain background (rendered first, behind modal) */}
      <MatrixRain animate={animate} />

      {/* Modal dialog overlay (rendered on top with position='absolute') */}
      <ModalDialog
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        confirmColor={confirmColor}
        cancelColor={cancelColor}
        onConfirm={onConfirm}
        onCancel={showCancel ? onCancel : undefined}
        logger={logger}
      />
    </Box>
  );
};
