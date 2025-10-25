import { Text, useInput } from 'ink';
import { marked } from 'marked';
// @ts-expect-error - marked-terminal has runtime named export but no TS declarations
import { markedTerminal } from 'marked-terminal';
import type { Logger } from './Logger.ts';

/**
 Props for MarkdownRenderer component
 */
export interface MarkdownRendererProps
{
  /**
   Markdown content to render
   */
  content: string;

  /**
   Callback when user presses any key to dismiss (or auto-dismisses)
   */
  onDone: () => void;

  /**
   Optional logger for debug output
   */
  logger?: Logger;
}

/**
 MarkdownRenderer - A black-box React component for displaying markdown

 Features:
 - Full markdown support using marked + marked-terminal
 - Tables, headings, lists, code blocks, bold, italic, links
 - Syntax highlighting support
 - Press any key to dismiss
 - Beautiful terminal formatting with ANSI colors

 @example
 ```tsx
 <MarkdownRenderer
   content="# Hello\n\nThis is **bold** text"
   onDone={() => console.log('User dismissed')}
 />
 ```
 */
// Configure marked to use terminal renderer (once, outside component)
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
marked.use(markedTerminal({ emoji: true, width: 80, reflowText: true, unescape: true }) as any);

export const MarkdownRenderer = ({
  content,
  onDone,
  logger,
}: MarkdownRendererProps) =>
{
  let dismissed = false;

  // Press any key to dismiss
  useInput((_input, _key) =>
  {
    if (!dismissed)
    {
      dismissed = true;
      logger?.log('User pressed key - dismissing markdown');
      onDone();
    }
  });

  // Convert markdown to ANSI-formatted string
  const formattedOutput = marked(content) as string;

  return (
    <>
      <Text>{formattedOutput}</Text>
      <Text dimColor italic>
        {'\n(Press any key to continue...)'}
      </Text>
    </>
  );
};
