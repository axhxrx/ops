#!/usr/bin/env bun

import { S3Client } from 'bun';
import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';
import type { S3Credentials, S3Entry } from './S3Types.ts';
import { S3Listing } from './S3Types.ts';

/**
 * Options for S3ListOp
 */
export type S3ListOpOptions = {
  /**
   * Prefix to list (like a directory path)
   * Default: '' (bucket root)
   */
  prefix?: string;

  /**
   * Maximum number of objects to return
   * Default: 1000 (S3 API limit)
   */
  maxKeys?: number;

  /**
   * Continuation token for pagination
   */
  continuationToken?: string;

  /**
   * Sort order (default: 'name-asc')
   */
  sortOrder?: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'modified-asc' | 'modified-desc';
};

/**
 * S3ListOp - List objects in an S3 bucket or prefix
 *
 * This is a non-UI op that lists objects in an S3 bucket using Bun's S3 API.
 * It returns an S3Listing object containing S3Entry objects with metadata.
 *
 * Features:
 * - Lists objects at a specific prefix (like browsing a directory)
 * - Handles pagination with continuation tokens
 * - Groups objects by common prefixes (directories)
 * - Sorts results
 *
 * Success value: S3Listing
 * Failure: 'authError' | 'bucketNotFound' | 'networkError' | 'unknownError'
 *
 * @example
 * ```typescript
 * const creds = { accessKeyId: '...', secretAccessKey: '...', bucket: 'my-bucket' };
 * const op = new S3ListOp(creds, { prefix: 'documents/' });
 * const result = await op.run();
 *
 * if (result.ok) {
 *   console.log('Found', result.value.entries.length, 'items');
 *   if (result.value.isTruncated) {
 *     // More results available, use nextContinuationToken
 *   }
 * }
 * ```
 */
export class S3ListOp extends Op
{
  name = 'S3ListOp';

  constructor(
    private credentials: S3Credentials,
    private options: S3ListOpOptions = {},
  )
  {
    super();
  }

  async run(_io?: IOContext)
  {
    try
    {
      // Create S3 client
      const _s3 = new S3Client({
        accessKeyId: this.credentials.accessKeyId,
        secretAccessKey: this.credentials.secretAccessKey,
        endpoint: this.credentials.endpoint,
        region: this.credentials.region || 'ap-northeast-1',
        bucket: this.credentials.bucket,
      });

      // Build list request options
      const listOptions: {
        prefix?: string;
        maxKeys?: number;
        delimiter?: string;
        startAfter?: string;
      } = {
        prefix: this.options.prefix || '',
        maxKeys: this.options.maxKeys || 1000,
        delimiter: '/', // Group by directory-like prefixes
      };

      if (this.options.continuationToken)
      {
        listOptions.startAfter = this.options.continuationToken;
      }

      // List objects
      // Note: Using static method since instance methods are for file operations
      const response = await S3Client.list(listOptions, {
        accessKeyId: this.credentials.accessKeyId,
        secretAccessKey: this.credentials.secretAccessKey,
        endpoint: this.credentials.endpoint,
        region: this.credentials.region || 'ap-northeast-1',
        bucket: this.credentials.bucket,
      });

      // Process results into S3Entry objects
      const entries: S3Entry[] = [];

      // Add directories (common prefixes)
      if (response.commonPrefixes)
      {
        for (const prefix of response.commonPrefixes)
        {
          const prefixStr = prefix.prefix || '';
          // Extract directory name from prefix
          // e.g., "documents/invoices/" -> "invoices"
          const name = this.extractDirectoryName(prefixStr, this.options.prefix || '');

          if (name)
          {
            entries.push({
              key: prefixStr,
              name,
              type: 'directory',
              size: 0,
              modified: new Date(),
              storageClass: undefined,
              etag: undefined,
            });
          }
        }
      }

      // Add files (contents)
      if (response.contents)
      {
        for (const object of response.contents)
        {
          // Skip the prefix itself if it appears as an object
          if (object.key === this.options.prefix)
          {
            continue;
          }

          // Extract file name from key
          const name = this.extractFileName(object.key || '', this.options.prefix || '');

          if (name)
          {
            entries.push({
              key: object.key || '',
              name,
              type: 'file',
              size: object.size || 0,
              modified: object.lastModified ? new Date(object.lastModified) : new Date(),
              storageClass: object.storageClass,
              etag: object.eTag,
            });
          }
        }
      }

      // Create listing and apply sort
      let listing = new S3Listing(
        this.credentials.bucket,
        this.options.prefix || '',
        entries,
        response.isTruncated || false,
        response.isTruncated ? (response.contents?.at(-1)?.key || undefined) : undefined,
      );

      if (this.options.sortOrder)
      {
        listing = listing.sort(this.options.sortOrder);
      }

      return this.succeed(listing);
    }
    catch (error: unknown)
    {
      // Classify the error
      if (error && typeof error === 'object')
      {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const errorMessage = String(error);

        if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('credentials'))
        {
          return this.fail('authError' as const, errorMessage);
        }

        if (errorMessage.includes('404') || errorMessage.includes('NoSuchBucket'))
        {
          return this.fail('bucketNotFound' as const, this.credentials.bucket);
        }

        if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED'))
        {
          return this.fail('networkError' as const, errorMessage);
        }
      }

      return this.fail('unknownError' as const, String(error));
    }
  }

  /**
   * Extract directory name from prefix
   * e.g., "documents/invoices/" with base "documents/" -> "invoices"
   */
  private extractDirectoryName(prefix: string, basePrefix: string): string
  {
    let name = prefix;

    // Remove base prefix
    if (basePrefix && name.startsWith(basePrefix))
    {
      name = name.substring(basePrefix.length);
    }

    // Remove trailing slash
    if (name.endsWith('/'))
    {
      name = name.substring(0, name.length - 1);
    }

    // If there are still slashes, take only the first part
    // (we want immediate children only)
    const slashIndex = name.indexOf('/');
    if (slashIndex !== -1)
    {
      name = name.substring(0, slashIndex);
    }

    return name;
  }

  /**
   * Extract file name from key
   * e.g., "documents/report.pdf" with base "documents/" -> "report.pdf"
   */
  private extractFileName(key: string, basePrefix: string): string
  {
    let name = key;

    // Remove base prefix
    if (basePrefix && name.startsWith(basePrefix))
    {
      name = name.substring(basePrefix.length);
    }

    // If there are slashes, this is in a subdirectory - skip it
    // (we want immediate children only)
    if (name.includes('/'))
    {
      return '';
    }

    return name;
  }
}

// CLI support - runnable as standalone program
if (import.meta.main)
{
  console.log('☁️  S3ListOp Demo\n');

  // This demo requires credentials in environment variables
  const bucket = Bun.argv[2] || process.env.S3_BUCKET || 'test-bucket';
  const prefix = Bun.argv[3] || '';

  console.log(`Listing bucket: ${bucket}`);
  console.log(`Prefix: ${prefix || '(root)'}\n`);

  // Get credentials from env
  const { S3CredentialsOp } = await import('./S3CredentialsOp');
  const credsOp = new S3CredentialsOp({ bucket });
  const credsResult = await credsOp.run();

  if (!credsResult.ok)
  {
    console.error('❌ Failed to get credentials');
    process.exit(1);
  }

  const creds = credsResult.value;

  // Test 1: List bucket root or specified prefix
  const op1 = new S3ListOp(creds, {
    prefix,
    sortOrder: 'name-asc',
  });

  const result1 = await op1.run();

  if (result1.ok)
  {
    const listing = result1.value;
    console.log(`✅ Success! Found ${listing.entries.length} items\n`);

    if (listing.entries.length === 0)
    {
      console.log('   (empty)');
    }
    else
    {
      // Show all entries
      console.log('Entries:');
      for (const entry of listing.entries)
      {
        const icon = entry.type === 'directory' ? '📁' : '☁️';
        const size = entry.type === 'file' ? ` (${entry.size} bytes)` : '';
        console.log(`  ${icon} ${entry.name}${size}`);
      }
    }

    if (listing.isTruncated)
    {
      console.log(`\n⚠️  More results available (truncated)`);
      console.log(`   Use continuation token: ${listing.nextContinuationToken}`);
    }

    // Test sorting
    if (listing.entries.length > 0)
    {
      console.log('\n📊 Testing sort by size (desc):');
      const sortedBySize = listing.sort('size-desc');
      const largestFiles = sortedBySize.entries.filter((e) => e.type === 'file').slice(0, 5);
      if (largestFiles.length > 0)
      {
        for (const entry of largestFiles)
        {
          console.log(`  ☁️  ${entry.name} (${entry.size.toLocaleString()} bytes)`);
        }
      }
      else
      {
        console.log('  (no files found)');
      }
    }

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

  console.log('\n✨ Demo complete!');
}
