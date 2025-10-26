#!/usr/bin/env bun

import type { IOContext } from './IOContext.ts';
import { BrowserOpBase } from './BrowserOpBase.ts';
import { S3ListOp } from './S3ListOp.ts';
import { S3CredentialsOp } from './S3CredentialsOp.ts';
import { S3Listing } from './S3Types.ts';
import type { S3Entry, S3Credentials } from './S3Types.ts';

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
   * Selection mode (default: 'file')
   */
  selectionMode?: S3BrowserSelectionMode;

  /**
   * Starting prefix (default: '' = bucket root)
   */
  startPrefix?: string;

  /**
   * Allow user to cancel with Escape (default: true)
   */
  cancelable?: boolean;

  /**
   * Custom filter function for entries
   */
  filter?: (entry: S3Entry) => boolean;

  /**
   * Sort order (default: 'name-asc')
   */
  sortOrder?: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'modified-asc' | 'modified-desc';
};

/**
 * Browse and select files/directories from S3
 *
 * Features:
 * - Navigate S3 prefixes with keyboard
 * - Single or multiple file/directory selection
 * - File metadata display (size, date, storage class)
 * - Folder icons and visual indicators
 * - Keyboard shortcuts for navigation
 *
 * Success value:
 * - Single selection modes: S3Entry
 * - Multi selection modes: S3Entry[]
 *
 * Failure: 'canceled' | 'authError' | 'bucketNotFound' | 'networkError' | 'unknownError'
 *
 * @example Select a single file
 * ```typescript
 * const op = new S3BrowserOp({
 *   bucket: 'my-bucket',
 *   selectionMode: 'file',
 *   startPrefix: 'documents/'
 * });
 * const result = await op.run();
 * if (result.ok) {
 *   console.log('Selected file:', result.value.key);
 * }
 * ```
 *
 * @example Select multiple files
 * ```typescript
 * const op = new S3BrowserOp({
 *   bucket: 'my-bucket',
 *   selectionMode: 'multi-files'
 * });
 * const result = await op.run();
 * if (result.ok) {
 *   console.log('Selected files:', result.value.map(e => e.name));
 * }
 * ```
 *
 * @example Select a directory (prefix)
 * ```typescript
 * const op = new S3BrowserOp({
 *   bucket: 'my-bucket',
 *   selectionMode: 'directory',
 *   startPrefix: 'backups/'
 * });
 * const result = await op.run();
 * if (result.ok) {
 *   console.log('Selected directory:', result.value.key);
 * }
 * ```
 */
export class S3BrowserOp extends BrowserOpBase<
  S3Entry,
  S3Listing,
  S3BrowserSelectionMode,
  S3Entry | S3Entry[],
  'canceled' | 'authError' | 'bucketNotFound' | 'networkError' | 'unknownError'
>
{
  name = 'S3BrowserOp';
  private currentPrefix: string;
  private credentials!: S3Credentials;

  constructor(private options: S3BrowserOpOptions)
  {
    super();
    this.currentPrefix = options.startPrefix ?? '';
  }

  // ==================== HOOKS ====================

  /**
   * Get S3 credentials before starting navigation
   */
  protected override async beforeRun(io?: IOContext)
  {
    // Get credentials first if not provided
    if (!this.options.credentials)
    {
      const credsOp = new S3CredentialsOp({
        bucket: this.options.bucket,
        cancelable: true,
      });

      const credsResult = await credsOp.run(io);
      if (!credsResult.ok) return credsResult as never;

      this.credentials = credsResult.value;
    }
    else
    {
      this.credentials = this.options.credentials;
    }

    return undefined;
  }

  /**
   * Apply custom filter if provided in options
   */
  protected override applyCustomFilter(listing: S3Listing): S3Listing
  {
    if (!this.options.filter)
    {
      return listing;
    }

    const filteredEntries = listing.entries.filter(this.options.filter);

    return new S3Listing(
      listing.bucket,
      listing.prefix,
      filteredEntries,
      listing.isTruncated,
      listing.nextContinuationToken,
    );
  }

  // ==================== ABSTRACT METHOD IMPLEMENTATIONS ====================

  protected async fetchListing(io?: IOContext)
  {
    const listOp = new S3ListOp(this.credentials, {
      prefix: this.currentPrefix,
      sortOrder: this.options.sortOrder ?? 'name-asc',
    });

    return await listOp.run(io);
  }

  protected navigateUp(): void
  {
    this.currentPrefix = this.getParentPrefix(this.currentPrefix);
  }

  protected navigateInto(entry: S3Entry): void
  {
    this.currentPrefix = entry.key;
  }

  protected shouldShowParentEntry(): boolean
  {
    // Show parent if we're not at bucket root
    return this.currentPrefix !== '';
  }

  protected getTitle(): string
  {
    const bucketDisplay = `s3://${this.options.bucket}`;
    const prefixDisplay = this.currentPrefix ? `/${this.currentPrefix}` : '/';
    return `☁️  ${bucketDisplay}${prefixDisplay}`;
  }

  protected getSelectionMode(): S3BrowserSelectionMode
  {
    return this.options.selectionMode ?? 'file';
  }

  protected isCancelable(): boolean
  {
    return this.options.cancelable ?? true;
  }

  protected getEntryName(entry: S3Entry): string
  {
    return entry.name;
  }

  protected isDirectory(entry: S3Entry): boolean
  {
    return entry.type === 'directory';
  }

  protected isDirectorySelectionMode(mode: S3BrowserSelectionMode): boolean
  {
    return mode === 'directory';
  }

  protected validateSingleSelection(entry: S3Entry, mode: S3BrowserSelectionMode): boolean
  {
    if (mode === 'any') return true;
    if (mode === 'file') return entry.type === 'file';
    if (mode === 'directory') return entry.type === 'directory';
    return true;
  }

  protected validateMultiSelection(entries: S3Entry[], mode: S3BrowserSelectionMode): boolean
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

  protected getValidationMessage(mode: S3BrowserSelectionMode): string
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

  // ==================== HELPER METHODS ====================

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
      // No parent, return empty (bucket root)
      return '';
    }

    // Return parent with trailing slash
    return normalized.substring(0, lastSlash + 1);
  }
}

if (import.meta.main)
{
  const { RenderMarkdownOp } = await import('./RenderMarkdownOp.tsx');

  const bucket = process.argv[2] || process.env.S3_BUCKET;

  if (!bucket)
  {
    console.error('Usage: bun S3BrowserOp.ts <bucket-name>');
    console.error('   or: S3_BUCKET=my-bucket bun S3BrowserOp.ts');
    process.exit(1);
  }

  // Track results for final summary
  const demo1Result: { type: 'file' | 'dir' | 'files'; name?: string; key?: string; size?: number; count?: number; canceled?: boolean } = { type: 'file' };

  console.log(`☁️  S3BrowserOp Demo - Browsing bucket: ${bucket}\n`);

  // Demo: Select a single file
  const fileOp = new S3BrowserOp({
    bucket,
    selectionMode: 'file',
  });

  const fileResult = await fileOp.run();

  if (fileResult.ok)
  {
    const file = fileResult.value as S3Entry;
    demo1Result.name = file.name;
    demo1Result.key = file.key;
    demo1Result.size = file.size;
  }
  else
  {
    demo1Result.canceled = true;
  }

  // Build final summary
  const summary: string[] = [];

  summary.push('# 🎉 S3BrowserOp Demo Complete!\n');
  summary.push('## Summary of What Happened\n');

  // Demo 1
  if (demo1Result.canceled)
  {
    summary.push('### Single File Selection\n🚫 **Canceled**\n');
  }
  else
  {
    summary.push('### Single File Selection\n');
    summary.push(`✅ Selected: \`${demo1Result.name}\``);
    summary.push(`🔑 Key: \`${demo1Result.key}\``);
    summary.push(`📊 Size: **${demo1Result.size?.toLocaleString() || 0} bytes**\n`);
  }

  summary.push('\n---\n');
  summary.push('## Features Demonstrated\n');
  summary.push('- ✨ S3 bucket browsing');
  summary.push('- ✨ Prefix (directory) navigation');
  summary.push('- ✨ File selection');
  summary.push('- ✨ Credential management');
  summary.push('- ✨ Terminal resize handling');
  summary.push('- ✨ Viewport scrolling for large buckets');
  summary.push('\nBuilt on **ShowTableOp** for maximum reusability! 🚀');

  await RenderMarkdownOp.run(summary.join('\n'));
}
