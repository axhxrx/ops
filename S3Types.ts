#!/usr/bin/env bun

import type { TableData, TableRow } from './ShowTableOp.tsx';

/**
 * S3 Credentials configuration
 */
export type S3Credentials = {
  /**
   * S3 access key ID
   */
  accessKeyId: string;

  /**
   * S3 secret access key
   */
  secretAccessKey: string;

  /**
   * S3 endpoint URL (optional, for S3-compatible services)
   * Examples:
   * - AWS S3: https://s3.amazonaws.com or https://s3.{region}.amazonaws.com
   * - Cloudflare R2: https://{account_id}.r2.cloudflarestorage.com
   * - DigitalOcean Spaces: https://{region}.digitaloceanspaces.com
   * - MinIO: http://localhost:9000
   */
  endpoint?: string;

  /**
   * AWS region (default: 'ap-northeast-1')
   */
  region?: string;

  /**
   * Bucket name
   */
  bucket: string;
};

/**
 * S3 entry type - similar to FileSystemEntryType but for S3
 */
export type S3EntryType = 'file' | 'directory';

/**
 * S3 object entry with metadata
 * Similar to FileSystemEntry but for S3 objects
 */
export type S3Entry = {
  /**
   * Object key (full path in bucket)
   */
  key: string;

  /**
   * Display name (last part of key)
   */
  name: string;

  /**
   * Entry type (file or directory)
   * Directories are inferred from keys ending with / or common prefixes
   */
  type: S3EntryType;

  /**
   * File size in bytes (0 for directories)
   */
  size: number;

  /**
   * Last modified timestamp
   */
  modified: Date;

  /**
   * ETag (entity tag) for versioning
   */
  etag?: string;

  /**
   * Storage class (STANDARD, GLACIER, etc.)
   */
  storageClass?: string;
};

/**
 * S3Listing - Data model for S3 bucket/prefix contents
 *
 * Similar to DirectoryListing but for S3 objects
 */
export class S3Listing
{
  constructor(
    public readonly bucket: string,
    public readonly prefix: string,
    public readonly entries: S3Entry[],
    public readonly isTruncated: boolean = false,
    public readonly nextContinuationToken?: string,
  )
  {}

  /**
   * Sort entries by the specified order
   * Always keeps directories first, then applies secondary sort
   */
  sort(order: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'modified-asc' | 'modified-desc'): S3Listing
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

    return new S3Listing(this.bucket, this.prefix, sorted, this.isTruncated, this.nextContinuationToken);
  }

  /**
   * Filter entries by custom predicate
   */
  filter(predicate: (entry: S3Entry) => boolean): S3Listing
  {
    return new S3Listing(
      this.bucket,
      this.prefix,
      this.entries.filter(predicate),
      this.isTruncated,
      this.nextContinuationToken,
    );
  }

  /**
   * Convert to TableData format for ShowTableOp
   * Includes parent directory (..) entry if not at bucket root
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

    // Add parent directory entry if requested and not at root
    if (includeParentEntry && this.prefix !== '')
    {
      rows.push({
        data: {
          icon: '📁',
          name: '..',
          size: '',
          modified: '',
          type: 'Parent',
        },
        helpText: 'Go up one level',
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
  private getEntryIcon(entry: S3Entry): string
  {
    switch (entry.type)
    {
      case 'directory':
        return '📁';
      case 'file':
        return '☁️'; // Cloud icon for S3 files
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
  private getEntryHelpText(entry: S3Entry): string
  {
    const lines: string[] = [];

    lines.push(`Bucket: ${this.bucket}`);
    lines.push(`Key: ${entry.key}`);
    lines.push(`Type: ${entry.type}`);

    if (entry.type === 'file')
    {
      lines.push(`Size: ${this.formatSize(entry.size)} (${entry.size.toLocaleString()} bytes)`);
    }

    lines.push(`Modified: ${entry.modified.toLocaleString()}`);

    if (entry.etag)
    {
      lines.push(`ETag: ${entry.etag}`);
    }

    if (entry.storageClass)
    {
      lines.push(`Storage: ${entry.storageClass}`);
    }

    if (entry.type === 'directory')
    {
      lines.push('\nPress Enter or → to open this prefix');
    }

    return lines.join('\n');
  }
}
