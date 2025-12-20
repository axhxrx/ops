#!/usr/bin/env bun

import { S3Client } from 'bun';
import { readdir, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';
import type { S3Credentials } from './S3Types.ts';

/**
 * Options for S3UploadOp
 */
export type S3UploadOpOptions = {
  /**
   * S3 key (path) where the file/folder should be uploaded
   * If not specified, uses the file/folder name
   */
  key?: string;

  /**
   * For directory uploads, whether to include the directory name in the key
   * Default: true
   * Example: uploading "mydir" with includeRoot=true -> "mydir/file.txt"
   *          uploading "mydir" with includeRoot=false -> "file.txt"
   */
  includeRoot?: boolean;

  /**
   * Show progress for each file (default: true)
   */
  showProgress?: boolean;
};

/**
 * Result of upload operation
 */
export type S3UploadResult = {
  /**
   * Number of files uploaded
   */
  filesUploaded: number;

  /**
   * Total bytes uploaded
   */
  bytesUploaded: number;

  /**
   * List of S3 keys that were uploaded
   */
  keys: string[];
};

/**
 * S3UploadOp - Upload file or directory to S3
 *
 * This op uploads a local file or directory to an S3 bucket.
 * For directories, it recursively uploads all files within.
 *
 * Features:
 * - Upload single file
 * - Recursive directory upload
 * - Progress reporting
 * - Proper error handling
 *
 * Success value: S3UploadResult
 * Failure: 'fileNotFound' | 'authError' | 'uploadError' | 'unknownError'
 *
 * @example Single file upload
 * ```typescript
 * const creds = { accessKeyId: '...', secretAccessKey: '...', bucket: 'my-bucket' };
 * const op = new S3UploadOp(creds, './document.pdf', { key: 'documents/doc.pdf' });
 * const result = await op.run();
 *
 * if (result.ok) {
 *   console.log(`Uploaded ${result.value.filesUploaded} files`);
 * }
 * ```
 *
 * @example Directory upload
 * ```typescript
 * const op = new S3UploadOp(creds, './my-folder', { key: 'backups/' });
 * const result = await op.run();
 * ```
 */
export class S3UploadOp extends Op
{
  name = 'S3UploadOp';

  constructor(
    private credentials: S3Credentials,
    private localPath: string,
    private options: S3UploadOpOptions = {},
  )
  {
    super();
  }

  async run(io?: IOContext)
  {
    try
    {
      // Check if local path exists
      const stats = await stat(this.localPath);

      // Create S3 client
      const s3 = new S3Client({
        accessKeyId: this.credentials.accessKeyId,
        secretAccessKey: this.credentials.secretAccessKey,
        endpoint: this.credentials.endpoint,
        region: this.credentials.region || 'ap-northeast-1',
        bucket: this.credentials.bucket,
      });

      const result: S3UploadResult = {
        filesUploaded: 0,
        bytesUploaded: 0,
        keys: [],
      };

      if (stats.isDirectory())
      {
        // Upload directory recursively
        await this.uploadDirectory(s3, this.localPath, io, result);
      }
      else if (stats.isFile())
      {
        // Upload single file
        await this.uploadFile(s3, this.localPath, this.options.key || basename(this.localPath), io, result);
      }
      else
      {
        return this.fail('fileNotFound' as const, `Path is not a file or directory: ${this.localPath}`);
      }

      return this.succeed(result);
    }
    catch (error: unknown)
    {
      if (error && typeof error === 'object' && 'code' in error)
      {
        if (error.code === 'ENOENT')
        {
          return this.fail('fileNotFound' as const, this.localPath);
        }
      }

      // Classify the error
      if (error && typeof error === 'object')
      {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const errorMessage = String(error);

        if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('credentials'))
        {
          return this.fail('authError' as const, errorMessage);
        }

        if (errorMessage.includes('upload') || errorMessage.includes('write'))
        {
          return this.fail('uploadError' as const, errorMessage);
        }
      }

      return this.fail('unknownError' as const, String(error));
    }
  }

  /**
   * Upload a single file to S3
   */
  private async uploadFile(
    s3: S3Client,
    filePath: string,
    s3Key: string,
    io: IOContext | undefined,
    result: S3UploadResult,
  ): Promise<void>
  {
    const showProgress = this.options.showProgress ?? true;

    if (showProgress)
    {
      this.log(io, `Uploading: ${filePath} -> s3://${this.credentials.bucket}/${s3Key}`);
    }

    // Read file as Bun.file and upload
    const file = Bun.file(filePath);
    const fileSize = file.size;

    // Upload using S3 client write method
    await s3.write(s3Key, file);

    result.filesUploaded++;
    result.bytesUploaded += fileSize;
    result.keys.push(s3Key);

    if (showProgress)
    {
      this.log(io, `✓ Uploaded ${s3Key} (${this.formatSize(fileSize)})`);
    }
  }

  /**
   * Upload directory recursively
   */
  private async uploadDirectory(
    s3: S3Client,
    dirPath: string,
    io: IOContext | undefined,
    result: S3UploadResult,
  ): Promise<void>
  {
    const items = await readdir(dirPath);

    for (const item of items)
    {
      const fullPath = join(dirPath, item);
      const stats = await stat(fullPath);

      if (stats.isDirectory())
      {
        // Recursively upload subdirectory
        await this.uploadDirectory(s3, fullPath, io, result);
      }
      else if (stats.isFile())
      {
        // Calculate S3 key for this file
        const s3Key = this.calculateS3Key(fullPath);
        await this.uploadFile(s3, fullPath, s3Key, io, result);
      }
    }
  }

  /**
   * Calculate S3 key for a local file path
   */
  private calculateS3Key(filePath: string): string
  {
    // If explicit key was provided, use it as the base
    const baseKey = this.options.key || '';

    // Get relative path from the upload root
    const relativePath = relative(this.localPath, filePath);

    // Handle includeRoot option for directory uploads
    const includeRoot = this.options.includeRoot ?? true;
    let finalKey: string;

    if (includeRoot)
    {
      const rootName = basename(this.localPath);
      finalKey = join(baseKey, rootName, relativePath);
    }
    else
    {
      finalKey = join(baseKey, relativePath);
    }

    // Normalize path separators to forward slashes for S3
    return finalKey.replace(/\\/g, '/');
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
  console.log('⬆️  S3UploadOp Demo\n');

  const args = process.argv.slice(2);
  const localPath = args[0];
  const s3Key = args[1];
  const bucket = process.env.S3_BUCKET || 'test-bucket';

  if (!localPath)
  {
    console.error('Usage: bun S3UploadOp.ts <local-path> [s3-key]');
    console.error('\nExample:');
    console.error('  bun S3UploadOp.ts ./myfile.txt documents/myfile.txt');
    console.error('  bun S3UploadOp.ts ./my-folder backups/');
    console.error('\nEnvironment variables:');
    console.error('  S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    process.exit(1);
  }

  console.log(`Local path: ${localPath}`);
  console.log(`S3 key: ${s3Key || '(auto)'}`);
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

  // Upload file or directory
  const uploadOp = new S3UploadOp(creds, localPath, {
    key: s3Key,
    showProgress: true,
  });

  const result = await uploadOp.run();

  if (result.ok)
  {
    const upload = result.value;
    console.log(`\n✅ Upload complete!`);
    console.log(`   Files uploaded: ${upload.filesUploaded}`);
    console.log(`   Bytes uploaded: ${upload.bytesUploaded.toLocaleString()}`);
    console.log(`   Keys:`);
    for (const key of upload.keys)
    {
      console.log(`     - ${key}`);
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
