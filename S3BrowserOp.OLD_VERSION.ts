#!/usr/bin/env bun

import type { IOContext } from './IOContext';
import { Op } from './Op';
import { ShowTableOp } from './ShowTableOp.tsx';
import type { TableData, TableRow } from './ShowTableOp.tsx';
import { S3ListOp } from './S3ListOp';
import { S3UploadOp } from './S3UploadOp';
import { S3DownloadOp } from './S3DownloadOp';
import { S3CredentialsOp } from './S3CredentialsOp';
import { InputTextOp } from './InputTextOp';
import type { S3Credentials, S3Entry, S3Listing } from './S3Types';

/**
 * Selection mode for S3 browser
 */
export type S3BrowserSelectionMode =
  | 'file' // Select a single file
  | 'directory' // Select a single directory (prefix)
  | 'any' // Select either file or directory
  | 'multi-files' // Select multiple files
  | 'multi-directories' // Select multiple directories
  | 'multi-any'; // Select multiple files and/or directories

/**
 * Options for S3BrowserOp
 */
export type S3BrowserOpOptions = {
  /**
   * Bucket name (required)
   */
  bucket: string;

  /**
   * S3 credentials (optional, will prompt if not provided)
   */
  credentials?: S3Credentials;

  /**
   * Starting prefix (default: '' = bucket root)
   */
  startPrefix?: string;

  /**
   * Selection mode (default: 'file')
   */
  selectionMode?: S3BrowserSelectionMode;

  /**
   * Allow user to cancel with Escape (default: true)
   */
  cancelable?: boolean;

  /**
   * Sort order (default: 'name-asc')
   */
  sortOrder?: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'modified-asc' | 'modified-desc';

  /**
   * Enable upload/download shortcuts (default: true)
   * When enabled:
   * - 'u' key prompts for upload
   * - 'd' key downloads selected item
   */
  enableShortcuts?: boolean;
};

/**
 * S3BrowserOp - Interactive S3 bucket browser
 *
 * Browse S3 buckets interactively with keyboard navigation.
 * Supports upload and download via keyboard shortcuts.
 *
 * Features:
 * - Navigate S3 prefixes (directories)
 * - Single or multiple file/directory selection
 * - Upload files/folders (keyboard shortcut: u)
 * - Download files/folders (keyboard shortcut: d)
 * - Visual indicators for files and directories
 *
 * Success value:
 * - Single selection modes: S3Entry
 * - Multi selection modes: S3Entry[]
 *
 * Failure: 'canceled' | 'authError' | 'bucketNotFound' | 'networkError' | 'unknownError'
 *
 * @example Browse and select a file
 * ```typescript
 * const op = new S3BrowserOp({
 *   bucket: 'my-bucket',
 *   selectionMode: 'file',
 * });
 * const result = await op.run();
 * if (result.ok) {
 *   console.log('Selected:', result.value.key);
 * }
 * ```
 *
 * @example Browse with upload/download
 * ```typescript
 * const op = new S3BrowserOp({
 *   bucket: 'my-bucket',
 *   enableShortcuts: true,
 * });
 * // User can press 'u' to upload, 'd' to download
 * ```
 */
export class S3BrowserOp extends Op
{
  name = 'S3BrowserOp';
  private currentPrefix: string;
  private credentials!: S3Credentials;

  constructor(private options: S3BrowserOpOptions)
  {
    super();
    this.currentPrefix = options.startPrefix ?? '';
  }

  async run(io?: IOContext)
  {
    // Get credentials first
    if (!this.options.credentials)
    {
      const credsOp = new S3CredentialsOp({
        bucket: this.options.bucket,
        cancelable: true,
      });

      const credsResult = await credsOp.run(io);
      if (!credsResult.ok) return credsResult;

      this.credentials = credsResult.value;
    }
    else
    {
      this.credentials = this.options.credentials;
    }

    const selectionMode = this.options.selectionMode ?? 'file';
    const isMultiSelect = selectionMode.startsWith('multi-');

    // Keep navigating until user selects or cancels
    let errorMsg: string | null = null;

    while (true)
    {
      // List current prefix using S3ListOp
      const listOp = new S3ListOp(this.credentials, {
        prefix: this.currentPrefix,
        sortOrder: this.options.sortOrder ?? 'name-asc',
      });

      const listResult = await listOp.run(io);

      if (!listResult.ok)
      {
        return listResult;
      }

      const listing = listResult.value;
      const entries = listing.entries;

      // Create table data from listing
      const tableData = this.createTableData(listing);

      // Build title with bucket and prefix info
      const bucketDisplay = `s3://${this.options.bucket}`;
      const prefixDisplay = this.currentPrefix ? `/${this.currentPrefix}` : '/';
      const shortcuts = this.options.enableShortcuts !== false ? ' [u=upload, d=download]' : '';
      const title = `☁️  ${bucketDisplay}${prefixDisplay}${shortcuts}`;

      // Show table with appropriate mode
      const tableOp = new ShowTableOp({
        mode: isMultiSelect ? 'select-multi' : 'select-row',
        dataProvider: tableData,
        cancelable: this.options.cancelable ?? true,
        title,
        errorMessage: errorMsg,
        fillHeight: true,
      });

      const tableResult = await tableOp.run(io);

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
          errorMsg = 'No items selected.\nPlease select at least one item with Space, then press Enter.';
          continue;
        }

        // Map selected rows back to S3Entry objects
        const selectedEntries = selectedRows
          .map((row) =>
          {
            const name = row.data.name;
            return entries.find((e) => e.name === name);
          })
          .filter((e): e is S3Entry => e !== undefined);

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
          // Go up one level
          this.currentPrefix = this.getParentPrefix(this.currentPrefix);
          continue;
        }

        const entry = entries.find((e) => e.name === name);

        if (!entry)
        {
          this.warn(io, 'Selected entry not found');
          continue;
        }

        // If it's a directory, descend into it
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
            this.currentPrefix = entry.key;
            continue;
          }
        }

        // It's a file - validate and return
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
   * Create table data from S3 listing
   */
  private createTableData(listing: S3Listing): TableData
  {
    // Check if we should include parent directory entry
    const includeParent = this.currentPrefix !== '';

    return listing.toTableData(includeParent);
  }

  /**
   * Get parent prefix from current prefix
   * e.g., "documents/invoices/" -> "documents/"
   *       "documents/" -> ""
   */
  private getParentPrefix(prefix: string): string
  {
    if (!prefix) return '';

    // Remove trailing slash
    const normalized = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;

    // Find last slash
    const lastSlash = normalized.lastIndexOf('/');

    if (lastSlash === -1)
    {
      // No parent, return empty
      return '';
    }

    // Return parent with trailing slash
    return normalized.substring(0, lastSlash + 1);
  }

  /**
   * Validate single selection
   */
  private validateSingleSelection(entry: S3Entry, mode: S3BrowserSelectionMode): boolean
  {
    if (mode === 'any') return true;
    if (mode === 'file') return entry.type === 'file';
    if (mode === 'directory') return entry.type === 'directory';
    return true;
  }

  /**
   * Validate multi selection
   */
  private validateMultiSelection(entries: S3Entry[], mode: S3BrowserSelectionMode): boolean
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
   * Get validation error message
   */
  private getValidationMessage(mode: S3BrowserSelectionMode): string
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

  console.log('☁️  S3BrowserOp Demo\n');

  const bucket = Bun.argv[2] || process.env.S3_BUCKET;

  if (!bucket)
  {
    console.error('Usage: bun S3BrowserOp.ts <bucket-name>');
    console.error('   or: S3_BUCKET=my-bucket bun S3BrowserOp.ts');
    process.exit(1);
  }

  console.log(`Browsing bucket: ${bucket}\n`);

  // Demo 1: Browse and select a file
  console.log('Demo 1: Browse and select a file\n');

  const fileOp = new S3BrowserOp({
    bucket,
    selectionMode: 'file',
    enableShortcuts: true,
  });

  const fileResult = await fileOp.run();

  let summary = '# 🎉 S3BrowserOp Demo Complete!\n\n';

  if (fileResult.ok)
  {
    const file = fileResult.value as S3Entry;
    summary += '## Selected File\n\n';
    summary += `✅ **Key:** \`${file.key}\`\n`;
    summary += `📊 **Size:** ${file.size.toLocaleString()} bytes\n`;
    summary += `📅 **Modified:** ${file.modified.toLocaleString()}\n\n`;
  }
  else if (fileResult.failure === 'canceled')
  {
    summary += '## Result\n\n';
    summary += '🚫 **Canceled** by user\n\n';
  }
  else
  {
    summary += '## Result\n\n';
    summary += `❌ **Error:** ${fileResult.failure}\n`;
    if (fileResult.debugData)
    {
      summary += `\nDebug: ${fileResult.debugData}\n`;
    }
    summary += '\n';
  }

  summary += '---\n\n';
  summary += '## Features Demonstrated\n\n';
  summary += '- ✨ S3 bucket browsing with navigation\n';
  summary += '- ✨ Directory (prefix) navigation\n';
  summary += '- ✨ File selection\n';
  summary += '- ✨ Credential management (env vars + prompts)\n';
  summary += '- ✨ Validation with error display\n';
  summary += '- ✨ Terminal resize handling\n';
  summary += '- ✨ Viewport scrolling\n';
  summary += '\n**Built on ShowTableOp and S3 ops for maximum reusability!** 🚀\n';

  await RenderMarkdownOp.run(summary);
}
