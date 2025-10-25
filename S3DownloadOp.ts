#!/usr/bin/env bun

import { S3Client } from 'bun';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';
import type { S3Credentials } from './S3Types.ts';
import { S3ListOp } from './S3ListOp.ts';

/**
 * Options for S3DownloadOp
 */
export type S3DownloadOpOptions = {
  /**
   * For directory downloads, whether to create the directory itself
   * Default: true
   * Example: downloading "mydir/" with createRoot=true -> "./mydir/file.txt"
   *          downloading "mydir/" with createRoot=false -> "./file.txt"
   */
  createRoot?: boolean;

  /**
   * Show progress for each file (default: true)
   */
  showProgress?: boolean;

  /**
   * Overwrite existing files (default: false)
   */
  overwrite?: boolean;
};

/**
 * Result of download operation
 */
export type S3DownloadResult = {
  /**
   * Number of files downloaded
   */
  filesDownloaded: number;

  /**
   * Total bytes downloaded
   */
  bytesDownloaded: number;

  /**
   * List of local paths that were created
   */
  paths: string[];
};

/**
 * S3DownloadOp - Download file or directory from S3
 *
 * This op downloads an S3 object or prefix (directory) to the local filesystem.
 * For prefixes, it recursively downloads all objects within.
 *
 * Features:
 * - Download single file
 * - Recursive directory download
 * - Progress reporting
 * - Overwrite protection
 *
 * Success value: S3DownloadResult
 * Failure: 'keyNotFound' | 'authError' | 'downloadError' | 'fileExists' | 'unknownError'
 *
 * @example Single file download
 * ```typescript
 * const creds = { accessKeyId: '...', secretAccessKey: '...', bucket: 'my-bucket' };
 * const op = new S3DownloadOp(creds, 'documents/doc.pdf', './downloaded.pdf');
 * const result = await op.run();
 *
 * if (result.ok) {
 *   console.log(`Downloaded ${result.value.filesDownloaded} files`);
 * }
 * ```
 *
 * @example Directory download
 * ```typescript
 * const op = new S3DownloadOp(creds, 'backups/', './my-backups');
 * const result = await op.run();
 * ```
 */
export class S3DownloadOp extends Op
{
  name = 'S3DownloadOp';

  constructor(
    private credentials: S3Credentials,
    private s3Key: string,
    private localPath: string,
    private options: S3DownloadOpOptions = {},
  )
  {
    super();
  }

  async run(io?: IOContext)
  {
    try
    {
      // Create S3 client
      const s3 = new S3Client({
        accessKeyId: this.credentials.accessKeyId,
        secretAccessKey: this.credentials.secretAccessKey,
        endpoint: this.credentials.endpoint,
        region: this.credentials.region || 'ap-northeast-1',
        bucket: this.credentials.bucket,
      });

      const result: S3DownloadResult = {
        filesDownloaded: 0,
        bytesDownloaded: 0,
        paths: [],
      };

      // Check if s3Key is a directory (ends with /) or a file
      if (this.s3Key.endsWith('/'))
      {
        // Download directory recursively
        await this.downloadDirectory(s3, this.s3Key, io, result);
      }
      else
      {
        // Try to download as a single file
        // First check if it exists
        const file = s3.file(this.s3Key);
        try
        {
          await file.exists();
          await this.downloadFile(s3, this.s3Key, this.localPath, io, result);
        }
        catch (_error: unknown)
        {
          // If file doesn't exist, try listing it as a prefix (directory without trailing /)
          const listOp = new S3ListOp(this.credentials, { prefix: this.s3Key + '/' });
          const listResult = await listOp.run(io);

          if (listResult.ok && listResult.value.entries.length > 0)
          {
            // It's actually a directory, download it
            await this.downloadDirectory(s3, this.s3Key + '/', io, result);
          }
          else
          {
            return this.fail('keyNotFound' as const, this.s3Key);
          }
        }
      }

      return this.succeed(result);
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

        if (errorMessage.includes('404') || errorMessage.includes('NoSuchKey'))
        {
          return this.fail('keyNotFound' as const, this.s3Key);
        }

        if (errorMessage.includes('exists') || errorMessage.includes('EEXIST'))
        {
          return this.fail('fileExists' as const, errorMessage);
        }

        if (errorMessage.includes('download'))
        {
          return this.fail('downloadError' as const, errorMessage);
        }
      }

      return this.fail('unknownError' as const, String(error));
    }
  }

  /**
   * Download a single file from S3
   */
  private async downloadFile(
    s3: S3Client,
    s3Key: string,
    localPath: string,
    io: IOContext | undefined,
    result: S3DownloadResult,
  ): Promise<void>
  {
    const showProgress = this.options.showProgress ?? true;

    if (showProgress)
    {
      this.log(io, `Downloading: s3://${this.credentials.bucket}/${s3Key} -> ${localPath}`);
    }

    // Check if local file exists and overwrite is false
    if (!this.options.overwrite)
    {
      try
      {
        await Bun.file(localPath).exists();
        throw new Error(`File exists: ${localPath}`);
      }
      catch
      {
        // File doesn't exist, continue
      }
    }

    // Ensure parent directory exists
    const parentDir = dirname(localPath);
    await mkdir(parentDir, { recursive: true });

    // Download file
    const file = s3.file(s3Key);
    const arrayBuffer = await file.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;

    // Write to local filesystem
    await writeFile(localPath, new Uint8Array(arrayBuffer));

    result.filesDownloaded++;
    result.bytesDownloaded += fileSize;
    result.paths.push(localPath);

    if (showProgress)
    {
      this.log(io, `✓ Downloaded ${localPath} (${this.formatSize(fileSize)})`);
    }
  }

  /**
   * Download directory recursively
   */
  private async downloadDirectory(
    s3: S3Client,
    prefix: string,
    io: IOContext | undefined,
    result: S3DownloadResult,
  ): Promise<void>
  {
    // List all objects with this prefix
    const listOp = new S3ListOp(this.credentials, {
      prefix,
      maxKeys: 1000,
    });

    const listResult = await listOp.run(io);

    if (!listResult.ok)
    {
      throw new Error(`Failed to list directory: ${listResult.failure}`);
    }

    const listing = listResult.value;

    // Download all files (skip directories)
    for (const entry of listing.entries)
    {
      if (entry.type === 'file')
      {
        // Calculate local path for this file
        const localFilePath = this.calculateLocalPath(entry.key, prefix);
        await this.downloadFile(s3, entry.key, localFilePath, io, result);
      }
      else if (entry.type === 'directory')
      {
        // Recursively download subdirectory
        await this.downloadDirectory(s3, entry.key, io, result);
      }
    }

    // Handle pagination if results were truncated
    if (listing.isTruncated && listing.nextContinuationToken)
    {
      const nextListOp = new S3ListOp(this.credentials, {
        prefix,
        maxKeys: 1000,
        continuationToken: listing.nextContinuationToken,
      });

      const nextListResult = await nextListOp.run(io);
      if (nextListResult.ok)
      {
        // Continue downloading from next page
        await this.downloadDirectory(s3, prefix, io, result);
      }
    }
  }

  /**
   * Calculate local file path from S3 key
   */
  private calculateLocalPath(s3Key: string, prefix: string): string
  {
    // Remove prefix from key to get relative path
    let relativePath = s3Key;
    if (prefix && s3Key.startsWith(prefix))
    {
      relativePath = s3Key.substring(prefix.length);
    }

    // Handle createRoot option
    const createRoot = this.options.createRoot ?? true;
    let finalPath: string;

    if (createRoot)
    {
      // Extract the prefix directory name
      const prefixName = prefix.endsWith('/') ? prefix.slice(0, -1).split('/').pop() || '' : '';
      finalPath = join(this.localPath, prefixName, relativePath);
    }
    else
    {
      finalPath = join(this.localPath, relativePath);
    }

    return finalPath;
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
}

// CLI support - runnable as standalone program
if (import.meta.main)
{
  console.log('⬇️  S3DownloadOp Demo\n');

  const args = process.argv.slice(2);
  const s3Key = args[0];
  const localPath = args[1];
  const bucket = process.env.S3_BUCKET || 'test-bucket';

  if (!s3Key || !localPath)
  {
    console.error('Usage: bun S3DownloadOp.ts <s3-key> <local-path>');
    console.error('\nExample:');
    console.error('  bun S3DownloadOp.ts documents/myfile.txt ./myfile.txt');
    console.error('  bun S3DownloadOp.ts backups/ ./my-backups');
    console.error('\nEnvironment variables:');
    console.error('  S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    process.exit(1);
  }

  console.log(`S3 key: ${s3Key}`);
  console.log(`Local path: ${localPath}`);
  console.log(`Bucket: ${bucket}\n`);

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

  // Download file or directory
  const downloadOp = new S3DownloadOp(creds, s3Key, localPath, {
    showProgress: true,
    overwrite: false,
  });

  const result = await downloadOp.run();

  if (result.ok)
  {
    const download = result.value;
    console.log(`\n✅ Download complete!`);
    console.log(`   Files downloaded: ${download.filesDownloaded}`);
    console.log(`   Bytes downloaded: ${download.bytesDownloaded.toLocaleString()}`);
    console.log(`   Paths:`);
    for (const path of download.paths)
    {
      console.log(`     - ${path}`);
    }
  }
  else
  {
    console.error(`\n❌ Error: ${result.failure}`);
    if (result.debugData)
    {
      console.error(`   ${result.debugData}`);
    }
    process.exit(1);
  }

  console.log('\n✨ Demo complete!');
}
