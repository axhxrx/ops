#!/usr/bin/env bun

import type { FileSystemEntry } from './SelectFromFilesystemOp.ts';
import type { TableData, TableRow } from './ShowTableOp.tsx';

/**
 * DirectoryListing - Simple data model for directory contents
 *
 * This is a "dumb" data object that holds FileSystemEntry objects
 * and provides basic methods for sorting, filtering, and converting to table format.
 *
 * Following the Ops Pattern, this is just a data container - no I/O, no side effects.
 */
export class DirectoryListing
{
  constructor(
    public readonly path: string,
    public readonly entries: FileSystemEntry[],
  )
  {}

  /**
   * Sort entries by the specified order
   * Always keeps directories first, then applies secondary sort
   */
  sort(order: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'modified-asc' | 'modified-desc'): DirectoryListing
  {
    const sorted = [...this.entries].sort((a, b) =>
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

    return new DirectoryListing(this.path, sorted);
  }

  /**
   * Filter entries by custom predicate
   */
  filter(predicate: (entry: FileSystemEntry) => boolean): DirectoryListing
  {
    return new DirectoryListing(
      this.path,
      this.entries.filter(predicate),
    );
  }

  /**
   * Filter out hidden files (entries starting with .)
   */
  withoutHidden(): DirectoryListing
  {
    return this.filter((entry) => !entry.hidden);
  }

  /**
   * Convert to TableData format for ShowTableOp
   * Includes parent directory (..) entry if not at root
   */
  toTableData(includeParentEntry: boolean = true): TableData
  {
    const rows: TableRow<{
      icon: string;
      name: string;
      size: string;
      modified: string;
      type: string;
    }>[] = [];

    // Add parent directory entry if requested
    if (includeParentEntry)
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
    for (const entry of this.entries)
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
   * Get icon for entry type
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
        return '📄';
      default:
        return '❓';
    }
  }

  /**
   * Format file size in human-readable format
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
   * Format date in readable format
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
   * Get help text for an entry
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
}
