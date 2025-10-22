#!/usr/bin/env bun

import { render } from 'ink';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { FilePreview } from './FilePreviewOp.ui';
import type { IOContext } from './IOContext';
import { Op } from './Op';
import { RenderMarkdownOp } from './RenderMarkdownOp';

/**
 Options for FilePreviewOp
 */
export interface FilePreviewOpOptions
{
  /**
   Maximum file size in bytes to preview. Files larger than this will fail with 'fileTooLarge'. Default: 10240 (10 KiB)
   */
  maxSizeBytes?: number;
}

/**
 FilePreviewOp - Preview text-based files with appropriate formatting

 Supports:
 - .md files: Rendered with RenderMarkdownOp (beautiful markdown rendering)
 - .json files: Pretty-printed JSON with syntax highlighting
 - .yml/.yaml files: Displayed as-is
 - .txt and other text files: Displayed as-is
 - Unknown extensions: Attempts to read as UTF-8 text, fails if not valid text

 Success value: void (displays preview and waits for key) or Op (RenderMarkdownOp for markdown files)

 Failure: 'fileNotFound' | 'fileTooLarge' | 'notUtf8Text' | 'readError'

 @example
 ```typescript
 const op = new FilePreviewOp('./README.md');
 const result = await op.run();

 if (result.ok) {
   console.log('Preview displayed!');
 } else if (result.failure === 'fileTooLarge') {
   console.log('File is too large to preview');
 }
 ```
 */
export class FilePreviewOp extends Op
{
  name = 'FilePreviewOp';
  private options: FilePreviewOpOptions;

  constructor(
    private filePath: string,
    options?: FilePreviewOpOptions,
  )
  {
    super();
    this.options = {
      maxSizeBytes: options?.maxSizeBytes ?? 10240, // Default: 10 KiB
    };
  }

  async run(io?: IOContext)
  {
    const ioContext = this.getIO(io);

    try
    {
      // Check file size first
      const { stat } = await import('node:fs/promises');
      const stats = await stat(this.filePath);

      if (stats.size > this.options.maxSizeBytes!)
      {
        const sizeKB = (stats.size / 1024).toFixed(2);
        const maxKB = (this.options.maxSizeBytes! / 1024).toFixed(2);
        return this.fail(
          'fileTooLarge' as const,
          `File size: ${sizeKB} KiB, Max: ${maxKB} KiB`,
        );
      }

      // Read file content as UTF-8
      let content: string;
      try
      {
        content = await readFile(this.filePath, 'utf-8');
      }
      catch (error: unknown)
      {
        // If it's a text encoding error, fail with notUtf8Text
        if (error && typeof error === 'object' && 'code' in error)
        {
          const errorMessage = 'message' in error ? String(error.message) : 'Text encoding error';
          return this.fail('notUtf8Text' as const, errorMessage);
        }
        throw error;
      }

      const ext = extname(this.filePath).toLowerCase();

      // Map file extensions to markdown code fence language identifiers
      const codeLanguageMap: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'tsx',
        '.js': 'javascript',
        '.jsx': 'jsx',
        '.rs': 'rust',
        '.go': 'go',
        '.py': 'python',
        '.rb': 'ruby',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.php': 'php',
        '.sh': 'bash',
        '.bash': 'bash',
        '.zsh': 'bash',
        '.fish': 'fish',
        '.css': 'css',
        '.scss': 'scss',
        '.sass': 'sass',
        '.html': 'html',
        '.xml': 'xml',
        '.json': 'json',
        '.yml': 'yaml',
        '.yaml': 'yaml',
        '.toml': 'toml',
        '.sql': 'sql',
        '.graphql': 'graphql',
        '.md': 'markdown',
        '.dockerfile': 'dockerfile',
      };

      // Handle markdown files specially
      if (ext === '.md' || ext === '.markdown')
      {
        const markdownOp = new RenderMarkdownOp(content);
        return this.succeed(markdownOp);
      }

      // If this is a code file, wrap it in a markdown code fence for syntax highlighting
      const language = codeLanguageMap[ext];
      if (language)
      {
        const wrappedContent =
          `# ${this.filePath}\n\n\`\`\`${language}\n${content}\n\`\`\`\n\n*Press any key to continue...*`;
        const markdownOp = new RenderMarkdownOp(wrappedContent);
        return this.succeed(markdownOp);
      }

      // For other text files or unknown extensions, use FilePreview component
      let done = false;

      const { unmount, waitUntilExit } = render(
        <FilePreview
          filePath={this.filePath}
          content={content}
          extension={ext || '.txt'}
          logger={ioContext.logger}
          onDone={() =>
          {
            this.log(io, 'File preview dismissed');
            done = true;
            unmount();
          }}
        />,
        {
          stdin: ioContext.stdin as NodeJS.ReadStream,
          stdout: ioContext.stdout as NodeJS.WriteStream,
        },
      );

      await waitUntilExit();

      if (!done)
      {
        return this.failWithUnknownError('File preview did not complete');
      }

      return this.succeed(undefined);
    }
    catch (error: unknown)
    {
      if (error && typeof error === 'object' && 'code' in error)
      {
        if (error.code === 'ENOENT')
        {
          return this.fail('fileNotFound' as const, this.filePath);
        }
      }

      return this.fail('readError' as const, String(error));
    }
  }
}

if (import.meta.main)
{
  const args = Bun.argv.slice(2);

  // If user provided a file path, preview that file
  if (args.length > 0)
  {
    const filePath = args[0]!;
    console.log(`📄 Previewing: ${filePath}\n`);

    const op = new FilePreviewOp(filePath);
    const outcome = await op.run();

    if (outcome.ok)
    {
      // For markdown, we get a RenderMarkdownOp back
      if (outcome.value && typeof outcome.value === 'object' && 'run' in outcome.value)
      {
        await (outcome.value as Op).run();
      }
      console.log('\n✅ Preview displayed!\n');
    }
    else
    {
      console.log('\n❌ Error:', outcome.failure);
      if (outcome.debugData)
      {
        console.log('   Details:', outcome.debugData);
      }

      if (outcome.failure === 'fileNotFound')
      {
        console.log('   The file does not exist.');
      }
      else if (outcome.failure === 'fileTooLarge')
      {
        console.log('   Try a smaller file or increase the size limit.');
      }
      else if (outcome.failure === 'notUtf8Text')
      {
        console.log('   The file is not valid UTF-8 text (may be binary).');
      }

      console.log('');
      process.exit(1);
    }
  }
  else
  {
    // No args - run demo
    console.log('🎬 FilePreviewOp Demo\n');
    console.log('Demonstrating different file type previews...\n');

    // Demo 1: Preview a markdown file
    console.log('📝 Example 1: Markdown file (OPS_PATTERN.md)');
    const mdOp = new FilePreviewOp('./OPS_PATTERN.md');
    const mdOutcome = await mdOp.run();

    if (mdOutcome.ok)
    {
      // For markdown, we get a RenderMarkdownOp back
      if (mdOutcome.value && typeof mdOutcome.value === 'object' && 'run' in mdOutcome.value)
      {
        await (mdOutcome.value as Op).run();
      }
      console.log('\n✅ Markdown preview displayed!\n');
    }
    else
    {
      console.log('❌ Error:', mdOutcome.failure, mdOutcome.debugData, '\n');
    }

    // Demo 2: Preview a JSON file
    console.log('📄 Example 2: JSON file (package.json)');
    const jsonOp = new FilePreviewOp('./package.json');
    const jsonOutcome = await jsonOp.run();

    if (jsonOutcome.ok)
    {
      console.log('\n✅ JSON preview displayed!\n');
    }
    else
    {
      console.log('❌ Error:', jsonOutcome.failure, jsonOutcome.debugData, '\n');
    }

    console.log('🎉 Demo complete!');
    console.log('\nTip: You can also preview a specific file:');
    console.log('  bun FilePreviewOp.tsx <file-path>');
  }
}
