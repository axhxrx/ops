#!/usr/bin/env bun

import { stat, readdir } from 'node:fs/promises';
import { join, dirname, sep } from 'node:path';
import type { Stats } from 'node:fs';
import type { IOContext } from './IOContext';
import { Op } from './Op';
import { ShowTableOp } from './ShowTableOp.tsx';
import type { TableData, TableRow } from './ShowTableOp.tsx';

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
export class SelectFromFilesystemOp extends Op
{
  name = 'SelectFromFilesystemOp';
  private currentPath: string;
  private selectedEntries: Set<string> = new Set();

  constructor(private options: SelectFromFilesystemOpOptions = {})
  {
    super();
    this.currentPath = options.startPath ?? process.cwd();
  }

  async run(io?: IOContext)
  {
    const selectionMode = this.options.selectionMode ?? 'file';
    const isMultiSelect = selectionMode.startsWith('multi-');

    // Keep navigating until user selects or cancels
    let errorMsg: string | null = null;

    while (true)
    {
      // Read current directory
      const entriesResult = await this.readDirectory(this.currentPath);

      if (!entriesResult.ok)
      {
        return entriesResult;
      }

      const entries = entriesResult.value;

      // Create table data from entries
      const tableData = this.createTableData(entries);

      // Show table with appropriate mode (include any error from previous iteration)
      const tableOp = new ShowTableOp({
        mode: isMultiSelect ? 'select-multi' : 'select-row',
        dataProvider: tableData,
        cancelable: this.options.cancelable ?? true,
        title: `📁 ${this.currentPath}`,
        errorMessage: errorMsg,
      });

      const tableResult = await tableOp.run();

      // Clear error after showing it once
      errorMsg = null;

      if (!tableResult.ok)
      {
        // User canceled or error occurred
        return tableResult;
      }

      // Handle selection based on mode
      const selected = tableResult.value as unknown as TableRow<{
        icon: string;
        name: string;
        size: string;
        modified: string;
        type: string;
      }> | TableRow<{
        icon: string;
        name: string;
        size: string;
        modified: string;
        type: string;
      }>[];

      if (isMultiSelect)
      {
        // Multi-select mode - return selected entries
        const selectedRows = selected as TableRow<{
          icon: string;
          name: string;
          size: string;
          modified: string;
          type: string;
        }>[];

        if (selectedRows.length === 0)
        {
          // Set error and loop to re-render with error
          errorMsg = 'No items selected.\nPlease select at least one item with Space, then press Enter.';
          continue;
        }

        // Map selected rows back to FileSystemEntry objects
        const selectedEntries = selectedRows
          .map((row) =>
          {
            const name = row.data.name;
            return entries.find((e) => e.name === name);
          })
          .filter((e): e is FileSystemEntry => e !== undefined);

        // Validate selection based on mode
        const isValid = this.validateMultiSelection(selectedEntries, selectionMode);

        if (!isValid)
        {
          errorMsg = this.getValidationMessage(selectionMode);
          continue;
        }

        return this.succeed(selectedEntries as never);
      }
      else
      {
        // Single-select mode
        const selectedRow = selected as TableRow<{
          icon: string;
          name: string;
          size: string;
          modified: string;
          type: string;
        }>;

        const name = selectedRow.data.name;

        // Handle special entries
        if (name === '..')
        {
          // Go up one directory
          this.currentPath = dirname(this.currentPath);
          continue;
        }

        const entry = entries.find((e) => e.name === name);

        if (!entry)
        {
          this.warn(io, 'Selected entry not found');
          continue;
        }

        // If it's a directory and we're in single-select mode, descend into it
        if (entry.type === 'directory')
        {
          if (selectionMode === 'directory')
          {
            // User wants to select this directory
            return this.succeed(entry as never);
          }
          else
          {
            // Descend into directory
            this.currentPath = entry.path;
            continue;
          }
        }

        // It's a file or other entry - validate and return
        const isValid = this.validateSingleSelection(entry, selectionMode);

        if (!isValid)
        {
          errorMsg = this.getValidationMessage(selectionMode);
          continue;
        }

        return this.succeed(entry as never);
      }
    }
  }

  /**
   Read directory and return FileSystemEntry array
   */
  private async readDirectory(dirPath: string)
  {
    try
    {
      const items = await readdir(dirPath);
      const entries: FileSystemEntry[] = [];

      for (const item of items)
      {
        const fullPath = join(dirPath, item);

        try
        {
          const stats = await stat(fullPath);
          const entry = this.createEntry(item, fullPath, stats);

          // Apply filters
          if (!this.options.showHidden && entry.hidden)
          {
            continue;
          }

          if (this.options.filter && !this.options.filter(entry))
          {
            continue;
          }

          entries.push(entry);
        }
        catch (_error)
        {
          // Skip entries we can't stat (permission denied, etc.)
          continue;
        }
      }

      // Sort entries
      this.sortEntries(entries);

      return this.succeed(entries);
    }
    catch (error: unknown)
    {
      if (error && typeof error === 'object' && 'code' in error)
      {
        if (error.code === 'ENOENT')
        {
          return this.fail('pathNotFound' as const, dirPath);
        }
        if (error.code === 'EACCES')
        {
          return this.fail('permissionDenied' as const, dirPath);
        }
      }

      return this.fail('unknownError' as const, String(error));
    }
  }

  /**
   Create FileSystemEntry from stats
   */
  private createEntry(name: string, path: string, stats: Stats): FileSystemEntry
  {
    const type: FileSystemEntryType = stats.isSymbolicLink()
      ? 'symlink'
      : stats.isDirectory()
      ? 'directory'
      : stats.isFile()
      ? 'file'
      : 'other';

    // Get permissions in octal format (e.g., '755')
    const permissions = (stats.mode & 0o777).toString(8);

    return {
      name,
      path,
      type,
      size: stats.size,
      modified: stats.mtime,
      permissions,
      hidden: name.startsWith('.'),
      stats,
    };
  }

  /**
   Sort entries based on sort order option
   */
  private sortEntries(entries: FileSystemEntry[]): void
  {
    const order = this.options.sortOrder ?? 'name-asc';

    // Always sort directories first, then apply secondary sort
    entries.sort((a, b) =>
    {
      // Directories always come first
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;

      // Apply secondary sort
      switch (order)
      {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'size-asc':
          return a.size - b.size;
        case 'size-desc':
          return b.size - a.size;
        case 'modified-asc':
          return a.modified.getTime() - b.modified.getTime();
        case 'modified-desc':
          return b.modified.getTime() - a.modified.getTime();
        default:
          return 0;
      }
    });
  }

  /**
   Create table data from file system entries
   */
  private createTableData(entries: FileSystemEntry[]): TableData
  {
    // Add parent directory entry if not at root
    const rows: TableRow<{
      icon: string;
      name: string;
      size: string;
      modified: string;
      type: string;
    }>[] = [];

    if (this.currentPath !== sep && dirname(this.currentPath) !== this.currentPath)
    {
      rows.push({
        data: {
          icon: '📁',
          name: '..',
          size: '',
          modified: '',
          type: 'Parent',
        },
        helpText: 'Go up one directory',
      });
    }

    // Add entries
    for (const entry of entries)
    {
      const icon = this.getEntryIcon(entry);
      const sizeStr = entry.type === 'directory' ? '' : this.formatSize(entry.size);
      const modifiedStr = this.formatDate(entry.modified);
      const typeStr = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);

      rows.push({
        data: {
          icon,
          name: entry.name,
          size: sizeStr,
          modified: modifiedStr,
          type: typeStr,
        },
        helpText: this.getEntryHelpText(entry),
      });
    }

    return {
      columns: [
        { key: 'icon', label: '', width: 2 },
        { key: 'name', label: 'Name', width: 40 },
        { key: 'size', label: 'Size', width: 10, align: 'right' },
        { key: 'modified', label: 'Modified', width: 20 },
        { key: 'type', label: 'Type', width: 12 },
      ],
      rows,
    };
  }

  /**
   Get icon for entry type
   */
  private getEntryIcon(entry: FileSystemEntry): string
  {
    switch (entry.type)
    {
      case 'directory':
        return '📁';
      case 'symlink':
        return '🔗';
      case 'file':
        // Could add file extension-based icons here
        return '📄';
      default:
        return '❓';
    }
  }

  /**
   Format file size in human-readable format
   */
  private formatSize(bytes: number): string
  {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  }

  /**
   Format date in readable format
   */
  private formatDate(date: Date): string
  {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = diff / (1000 * 60 * 60 * 24);

    if (days < 1)
    {
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    else if (days < 365)
    {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    }
    else
    {
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }

  /**
   Get help text for an entry
   */
  private getEntryHelpText(entry: FileSystemEntry): string
  {
    const lines: string[] = [];

    lines.push(`Path: ${entry.path}`);
    lines.push(`Type: ${entry.type}`);

    if (entry.type === 'file')
    {
      lines.push(`Size: ${this.formatSize(entry.size)} (${entry.size.toLocaleString()} bytes)`);
    }

    lines.push(`Modified: ${entry.modified.toLocaleString()}`);
    lines.push(`Permissions: ${entry.permissions}`);

    if (entry.type === 'directory')
    {
      lines.push('\nPress Enter or → to open this directory');
    }

    return lines.join('\n');
  }

  /**
   Validate single selection
   */
  private validateSingleSelection(entry: FileSystemEntry, mode: FileSystemSelectionMode): boolean
  {
    if (mode === 'any') return true;
    if (mode === 'file') return entry.type === 'file';
    if (mode === 'directory') return entry.type === 'directory';
    return true;
  }

  /**
   Validate multi selection
   */
  private validateMultiSelection(entries: FileSystemEntry[], mode: FileSystemSelectionMode): boolean
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

  /**
   Get validation error message
   */
  private getValidationMessage(mode: FileSystemSelectionMode): string
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
  const demo1Result: { type: 'file' | 'dir' | 'files'; name?: string; size?: number; count?: number; canceled?: boolean } = { type: 'file' };
  const demo2Result: { type: 'file' | 'dir' | 'files'; name?: string; canceled?: boolean } = { type: 'dir' };
  const demo3Result: { type: 'file' | 'dir' | 'files'; count?: number; names?: string[]; canceled?: boolean } = { type: 'files' };

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
