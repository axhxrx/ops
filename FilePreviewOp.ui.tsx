import { Box, Text, useInput } from 'ink';
import type { Logger } from './Logger';

/**
 Props for FilePreview component
 */
export interface FilePreviewProps
{
  /**
   File path to display
   */
  filePath: string;

  /**
   File content to display
   */
  content: string;

  /**
   File extension (e.g., '.json', '.txt')
   */
  extension: string;

  /**
   Callback when user presses any key to dismiss
   */
  onDone: () => void;

  /**
   Optional logger for debug output
   */
  logger?: Logger;
}

/**
 FilePreview - Display file content with appropriate formatting

 Features:
 - Pretty-prints JSON with indentation
 - Shows file path as header
 - Press any key to dismiss
 - Syntax highlighting for JSON (color coding)

 @example
 ```tsx
 <FilePreview
   filePath="./config.json"
   content={fileContent}
   extension=".json"
   onDone={() => console.log('User dismissed')}
 />
 ```
 */
export const FilePreview = ({
  filePath,
  content,
  extension,
  onDone,
  logger,
}: FilePreviewProps) =>
{
  let dismissed = false;

  // Press any key to dismiss
  useInput((_input, _key) =>
  {
    if (!dismissed)
    {
      dismissed = true;
      logger?.log('User pressed key - dismissing file preview');
      onDone();
    }
  });

  // Format content based on extension
  let formattedContent = content;
  let error: string | null = null;

  if (extension === '.json')
  {
    try
    {
      const parsed: unknown = JSON.parse(content);
      formattedContent = JSON.stringify(parsed, null, 2);
    }
    catch (_jsonError)
    {
      error = 'Invalid JSON format - displaying as-is';
    }
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📄 File: {filePath}
        </Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="yellow">⚠️  {error}</Text>
        </Box>
      )}

      <Box flexDirection="column">
        <Text>{formattedContent}</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor italic>
          (Press any key to continue...)
        </Text>
      </Box>
    </Box>
  );
};
