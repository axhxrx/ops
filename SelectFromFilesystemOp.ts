#!/usr/bin/env bun

import type { Stats } from 'node:fs';
import { dirname, sep } from 'node:path';
import { BrowserOpBase } from './BrowserOpBase.ts';
import type { DirectoryListing } from './DirectoryListing.ts';
import type { IOContext } from './IOContext.ts';
import { ListDirectoryOp } from './ListDirectoryOp.ts';

/**
 File system entry type
 */
export type FileSystemEntryType = 'file' | 'directory' | 'symlink' | 'other';

/**
 File system entry with metadata
 */
export type FileSystemEntry = {
  /**
   File or directory name
   */
  name: string;

  /**
   Full path to the entry
   */
  path: string;

  /**
   Entry type
   */
  type: FileSystemEntryType;

  /**
   File size in bytes (0 for directories)
   */
  size: number;

  /**
   Last modified timestamp
   */
  modified: Date;

  /**
   File permissions in octal (e.g., '755')
   */
  permissions: string;

  /**
   Whether this is a hidden file/folder (starts with .)
   */
  hidden: boolean;

  /**
   File stats object
   */
  stats: Stats;
};

/**
 Selection mode for filesystem browser
 */
export type FileSystemSelectionMode =
  | 'file' // Select a single file
  | 'directory' // Select a single directory
  | 'any' // Select either file or directory
  | 'multi-files' // Select multiple files
  | 'multi-directories' // Select multiple directories
  | 'multi-any'; // Select multiple files and/or directories

/**
 Options for SelectFromFilesystemOp
 */
export type SelectFromFilesystemOpOptions = {
  /**
   Selection mode (default: 'file')
   */
  selectionMode?: FileSystemSelectionMode;

  /**
   Starting directory path (default: current working directory)
   */
  startPath?: string;

  /**
   Show hidden files/folders (default: false)
   */
  showHidden?: boolean;

  /**
   Allow user to cancel with Escape (default: true)
   */
  cancelable?: boolean;

  /**
   Custom filter function for entries
   */
  filter?: (entry: FileSystemEntry) => boolean;

  /**
   Sort order (default: 'name-asc')
   */
  sortOrder?: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'modified-asc' | 'modified-desc';
};

/**
 Browse and select files/directories from the filesystem

 Features:
 - Navigate directories with keyboard
 - Single or multiple file/directory selection
 - File metadata display (size, date, permissions)
 - Folder icons and visual indicators
 - Hidden file filtering
 - Keyboard shortcuts for navigation

 Success value:
 - Single selection modes: FileSystemEntry
 - Multi selection modes: FileSystemEntry[]

 Failure: 'canceled' | 'pathNotFound' | 'permissionDenied' | 'unknownError'

 @example Select a single file
 ```typescript
 const op = new SelectFromFilesystemOp({
   selectionMode: 'file',
   startPath: './src'
 });
 const result = await op.run();
 if (result.ok) {
   console.log('Selected file:', result.value.path);
 }
 ```

 @example Select multiple files
 ```typescript
 const op = new SelectFromFilesystemOp({
   selectionMode: 'multi-files',
   showHidden: false
 });
 const result = await op.run();
 if (result.ok) {
   console.log('Selected files:', result.value.map(e => e.name));
 }
 ```

 @example Select a directory
 ```typescript
 const op = new SelectFromFilesystemOp({
   selectionMode: 'directory',
   startPath: process.env.HOME
 });
 const result = await op.run();
 if (result.ok) {
   console.log('Selected directory:', result.value.path);
 }
 ```
 */
export class SelectFromFilesystemOp extends BrowserOpBase<
  FileSystemEntry,
  DirectoryListing,
  FileSystemSelectionMode,
  FileSystemEntry | FileSystemEntry[],
  'canceled' | 'pathNotFound' | 'permissionDenied' | 'notADirectory' | 'unknownError'
>
{
  name = 'SelectFromFilesystemOp';
  private currentPath: string;

  constructor(private options: SelectFromFilesystemOpOptions = {})
  {
    super();
    this.currentPath = options.startPath ?? process.cwd();
  }

  // ==================== ABSTRACT METHOD IMPLEMENTATIONS ====================

  protected async fetchListing(io?: IOContext)
  {
    const listOp = new ListDirectoryOp(this.currentPath, {
      showHidden: this.options.showHidden ?? false,
      filter: this.options.filter,
      sortOrder: this.options.sortOrder ?? 'name-asc',
    });

    return await listOp.run(io);
  }

  protected navigateUp(): void
  {
    this.currentPath = dirname(this.currentPath);
  }

  protected navigateInto(entry: FileSystemEntry): void
  {
    this.currentPath = entry.path;
  }

  protected shouldShowParentEntry(): boolean
  {
    // Show parent if we're not at root and parent is different from current
    return this.currentPath !== sep && dirname(this.currentPath) !== this.currentPath;
  }

  protected getTitle(): string
  {
    return `📁 ${this.currentPath}`;
  }

  protected getSelectionMode(): FileSystemSelectionMode
  {
    return this.options.selectionMode ?? 'file';
  }

  protected isCancelable(): boolean
  {
    return this.options.cancelable ?? true;
  }

  protected getEntryName(entry: FileSystemEntry): string
  {
    return entry.name;
  }

  protected isDirectory(entry: FileSystemEntry): boolean
  {
    return entry.type === 'directory';
  }

  protected isDirectorySelectionMode(mode: FileSystemSelectionMode): boolean
  {
    return mode === 'directory';
  }

  protected validateSingleSelection(entry: FileSystemEntry, mode: FileSystemSelectionMode): boolean
  {
    if (mode === 'any') return true;
    if (mode === 'file') return entry.type === 'file';
    if (mode === 'directory') return entry.type === 'directory';
    return true;
  }

  protected validateMultiSelection(entries: FileSystemEntry[], mode: FileSystemSelectionMode): boolean
  {
    if (mode === 'multi-any') return true;

    if (mode === 'multi-files')
    {
      return entries.every((e) => e.type === 'file');
    }

    if (mode === 'multi-directories')
    {
      return entries.every((e) => e.type === 'directory');
    }

    return true;
  }

  protected getValidationMessage(mode: FileSystemSelectionMode): string
  {
    switch (mode)
    {
      case 'file':
        return 'Please select a file, not a directory';
      case 'directory':
        return 'Please select a directory, not a file';
      case 'multi-files':
        return 'Please select only files';
      case 'multi-directories':
        return 'Please select only directories';
      default:
        return 'Invalid selection';
    }
  }
}

if (import.meta.main)
{
  const { RenderMarkdownOp } = await import('./RenderMarkdownOp.tsx');

  // Track results for final summary
  const demo1Result: { type: 'file' | 'dir' | 'files'; name?: string; size?: number; count?: number;
    canceled?: boolean } = { type: 'file' };
  const demo2Result: { type: 'file' | 'dir' | 'files'; name?: string; canceled?: boolean } = { type: 'dir' };
  const demo3Result: { type: 'file' | 'dir' | 'files'; count?: number; names?: string[]; canceled?: boolean } = {
    type: 'files',
  };

  // Demo 1: Select a single file
  const fileOp = new SelectFromFilesystemOp({
    selectionMode: 'file',
    startPath: process.cwd(),
    showHidden: false,
  });

  const fileResult = await fileOp.run();

  if (fileResult.ok)
  {
    const file = fileResult.value as FileSystemEntry;
    demo1Result.name = file.name;
    demo1Result.size = file.size;
  }
  else
  {
    demo1Result.canceled = true;
  }

  // Demo 2: Select a directory
  const dirOp = new SelectFromFilesystemOp({
    selectionMode: 'directory',
    startPath: process.cwd(),
  });

  const dirResult = await dirOp.run();

  if (dirResult.ok)
  {
    const dir = dirResult.value as FileSystemEntry;
    demo2Result.name = dir.name;
  }
  else
  {
    demo2Result.canceled = true;
  }

  // Demo 3: Multi-select files
  const multiFileOp = new SelectFromFilesystemOp({
    selectionMode: 'multi-files',
    startPath: process.cwd(),
    showHidden: false,
  });

  const multiResult = await multiFileOp.run();

  if (multiResult.ok)
  {
    const files = multiResult.value as FileSystemEntry[];
    demo3Result.count = files.length;
    demo3Result.names = files.map((f) => f.name);
  }
  else
  {
    demo3Result.canceled = true;
  }

  // Build final summary
  const summary: string[] = [];

  summary.push('# 🎉 SelectFromFilesystemOp Demo Complete!\n');
  summary.push('## Summary of What Happened\n');

  // Demo 1
  if (demo1Result.canceled)
  {
    summary.push('### Demo 1: Single File Selection\n🚫 **Canceled**\n');
  }
  else
  {
    summary.push('### Demo 1: Single File Selection\n');
    summary.push(`✅ Selected: \`${demo1Result.name}\``);
    summary.push(`📊 Size: **${demo1Result.size?.toLocaleString() || 0} bytes**\n`);
  }

  // Demo 2
  if (demo2Result.canceled)
  {
    summary.push('### Demo 2: Directory Selection\n🚫 **Canceled**\n');
  }
  else
  {
    summary.push('### Demo 2: Directory Selection\n');
    summary.push(`✅ Selected: \`${demo2Result.name}\`\n`);
  }

  // Demo 3
  if (demo3Result.canceled)
  {
    summary.push('### Demo 3: Multi-File Selection\n🚫 **Canceled**\n');
  }
  else
  {
    summary.push('### Demo 3: Multi-File Selection\n');
    summary.push(`✅ Selected **${demo3Result.count} file${demo3Result.count === 1 ? '' : 's'}**:\n`);
    if (demo3Result.names && demo3Result.names.length > 0)
    {
      summary.push(demo3Result.names.map((n) => `- \`${n}\``).join('\n'));
      summary.push('');
    }
  }

  summary.push('\n---\n');
  summary.push('## Features Demonstrated\n');
  summary.push('- ✨ Single file/directory selection');
  summary.push('- ✨ Multi-select with checkboxes (Space to toggle)');
  summary.push('- ✨ Directory navigation');
  summary.push('- ✨ Validation with prominent error display');
  summary.push('- ✨ Terminal resize handling');
  summary.push('- ✨ Viewport scrolling for large directories');
  summary.push('\nBuilt on **ShowTableOp** for maximum reusability! 🚀');

  await RenderMarkdownOp.run(summary.join('\n'));
}
