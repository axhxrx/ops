#!/usr/bin/env bun

import type { Stats } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { DirectoryListing } from './DirectoryListing.ts';
import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';
import type { FileSystemEntry, FileSystemEntryType } from './SelectFromFilesystemOp.ts';

/**
 * Options for ListDirectoryOp
 */
export type ListDirectoryOpOptions = {
  /**
   * Show hidden files/folders (default: false)
   */
  showHidden?: boolean;

  /**
   * Custom filter function for entries
   */
  filter?: (entry: FileSystemEntry) => boolean;

  /**
   * Sort order (default: 'name-asc')
   */
  sortOrder?: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'modified-asc' | 'modified-desc';
};

/**
 * ListDirectoryOp - Read directory contents and return DirectoryListing
 *
 * This is a non-UI op that reads a directory from the filesystem and returns
 * a DirectoryListing object containing FileSystemEntry objects with metadata.
 *
 * Following the Ops Pattern, this op:
 * - Does one thing: reads a directory
 * - Returns strongly-typed success/failure
 * - Has no UI concerns
 * - Can be run standalone
 * - Is independently testable
 *
 * Success value: DirectoryListing
 * Failure: 'pathNotFound' | 'permissionDenied' | 'notADirectory' | 'unknownError'
 *
 * @example
 * ```typescript
 * const op = new ListDirectoryOp('/home/user/documents', {
 *   showHidden: false,
 *   sortOrder: 'name-asc'
 * });
 * const result = await op.run();
 *
 * if (result.ok) {
 *   console.log('Found', result.value.entries.length, 'items');
 *   const tableData = result.value.toTableData();
 * } else {
 *   console.error('Error:', result.failure);
 * }
 * ```
 */
export class ListDirectoryOp extends Op
{
  name = 'ListDirectoryOp';

  constructor(
    private dirPath: string,
    private options: ListDirectoryOpOptions = {},
  )
  {
    super();
  }

  async run(_io?: IOContext)
  {
    try
    {
      // First, verify the path exists and is a directory
      const dirStats = await stat(this.dirPath);
      if (!dirStats.isDirectory())
      {
        return this.fail('notADirectory' as const, this.dirPath);
      }

      const items = await readdir(this.dirPath);
      const entries: FileSystemEntry[] = [];

      for (const item of items)
      {
        const fullPath = join(this.dirPath, item);

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

      // Create listing and apply sort
      let listing = new DirectoryListing(this.dirPath, entries);
      if (this.options.sortOrder)
      {
        listing = listing.sort(this.options.sortOrder);
      }

      return this.succeed(listing);
    }
    catch (error: unknown)
    {
      if (error && typeof error === 'object' && 'code' in error)
      {
        if (error.code === 'ENOENT')
        {
          return this.fail('pathNotFound' as const, this.dirPath);
        }
        if (error.code === 'EACCES')
        {
          return this.fail('permissionDenied' as const, this.dirPath);
        }
      }

      return this.fail('unknownError' as const, String(error));
    }
  }

  /**
   * Create FileSystemEntry from stats
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
}

// CLI support - runnable as standalone program
if (import.meta.main)
{
  console.log('📂 ListDirectoryOp Demo\n');

  const args = process.argv.slice(2);
  const dirPath = args[0] || process.cwd();
  const showHidden = args.includes('--hidden');

  console.log(`Listing directory: ${dirPath}`);
  console.log(`Show hidden: ${showHidden}\n`);

  // Test 1: List current directory
  const op1 = new ListDirectoryOp(dirPath, {
    showHidden,
    sortOrder: 'name-asc',
  });

  const result1 = await op1.run();

  if (result1.ok)
  {
    const listing = result1.value;
    console.log(`✅ Success! Found ${listing.entries.length} items\n`);

    // Show first 10 entries
    const entriesToShow = listing.entries.slice(0, 10);
    console.log('First 10 entries:');
    for (const entry of entriesToShow)
    {
      const icon = entry.type === 'directory' ? '📁' : entry.type === 'symlink' ? '🔗' : '📄';
      const size = entry.type === 'file' ? ` (${entry.size} bytes)` : '';
      console.log(`  ${icon} ${entry.name}${size}`);
    }

    if (listing.entries.length > 10)
    {
      console.log(`  ... and ${listing.entries.length - 10} more`);
    }

    // Test sorting
    console.log('\n📊 Testing sort by size (desc):');
    const sortedBySize = listing.sort('size-desc');
    const largestFiles = sortedBySize.entries.filter((e) => e.type === 'file').slice(0, 5);
    for (const entry of largestFiles)
    {
      console.log(`  📄 ${entry.name} (${entry.size.toLocaleString()} bytes)`);
    }

    // Test filtering
    console.log('\n🔍 Testing filter (TypeScript files only):');
    const tsFilesOnly = listing.filter((e) => e.name.endsWith('.ts') || e.name.endsWith('.tsx'));
    console.log(`  Found ${tsFilesOnly.entries.length} TypeScript files`);

    // Test table conversion
    console.log('\n📋 Converting to table data...');
    const tableData = listing.toTableData();
    console.log(`  Table has ${tableData.columns.length} columns and ${tableData.rows.length} rows`);
  }
  else
  {
    console.error(`❌ Error: ${result1.failure}`);
    if (result1.debugData)
    {
      console.error(`   ${result1.debugData}`);
    }
    process.exit(1);
  }

  // Test 2: Try to list a non-existent directory
  console.log('\n\n🧪 Testing error handling (non-existent directory):');
  const op2 = new ListDirectoryOp('/this/path/does/not/exist');
  const result2 = await op2.run();

  if (!result2.ok && result2.failure === 'pathNotFound')
  {
    console.log('✅ Correctly returned pathNotFound error');
  }
  else
  {
    console.error('❌ Expected pathNotFound error');
    process.exit(1);
  }

  console.log('\n✨ All tests passed!');
}
