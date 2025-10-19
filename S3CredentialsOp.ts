#!/usr/bin/env bun

import type { IOContext } from './IOContext';
import { Op } from './Op';
import { InputTextOp } from './InputTextOp';
import type { S3Credentials } from './S3Types';

/**
 * Options for S3CredentialsOp
 */
export type S3CredentialsOpOptions = {
  /**
   * Bucket name (required)
   */
  bucket: string;

  /**
   * Force prompt even if env vars are set (default: false)
   */
  forcePrompt?: boolean;

  /**
   * Allow user to cancel with Escape (default: true)
   */
  cancelable?: boolean;

  /**
   * Pre-filled values (override env vars)
   */
  defaults?: Partial<S3Credentials>;
};

/**
 * S3CredentialsOp - Get S3 credentials with env var fallback
 *
 * This op tries to read credentials from environment variables first:
 * - AWS_ACCESS_KEY_ID or S3_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY or S3_SECRET_ACCESS_KEY
 * - AWS_ENDPOINT or S3_ENDPOINT (optional)
 * - AWS_REGION or S3_REGION (optional, default: ap-northeast-1)
 *
 * If environment variables are not found (or forcePrompt is true),
 * prompts the user to enter credentials interactively.
 *
 * Success value: S3Credentials
 * Failure: 'canceled'
 *
 * @example
 * ```typescript
 * const op = new S3CredentialsOp({ bucket: 'my-bucket' });
 * const result = await op.run();
 *
 * if (result.ok) {
 *   const creds = result.value;
 *   // Use creds with S3Client
 * }
 * ```
 */
export class S3CredentialsOp extends Op
{
  name = 'S3CredentialsOp';

  constructor(private options: S3CredentialsOpOptions)
  {
    super();
  }

  async run(io?: IOContext)
  {
    const ioContext = this.getIO(io);

    // Try to get credentials from environment variables first
    if (!this.options.forcePrompt)
    {
      const envCreds = this.getCredentialsFromEnv();
      if (envCreds)
      {
        this.log(io, 'Using S3 credentials from environment variables');
        return this.succeed(envCreds);
      }
    }

    this.log(io, 'S3 credentials not found in environment, prompting user...');

    // Prompt for access key ID
    const accessKeyIdOp = new InputTextOp('Enter S3 Access Key ID:', {
      cancelable: this.options.cancelable ?? true,
      minLength: 1,
      initialValue: this.options.defaults?.accessKeyId,
    });

    const accessKeyIdResult = await accessKeyIdOp.run(io);
    if (!accessKeyIdResult.ok) return accessKeyIdResult;

    // Prompt for secret access key (masked input would be better, but InputTextOp doesn't support it yet)
    const secretAccessKeyOp = new InputTextOp('Enter S3 Secret Access Key:', {
      cancelable: this.options.cancelable ?? true,
      minLength: 1,
      initialValue: this.options.defaults?.secretAccessKey,
    });

    const secretAccessKeyResult = await secretAccessKeyOp.run(io);
    if (!secretAccessKeyResult.ok) return secretAccessKeyResult;

    // Prompt for endpoint (optional)
    const endpointOp = new InputTextOp('Enter S3 Endpoint (optional, press Enter to skip):', {
      cancelable: this.options.cancelable ?? true,
      placeholder: 'https://s3.amazonaws.com',
      initialValue: this.options.defaults?.endpoint,
    });

    const endpointResult = await endpointOp.run(io);
    if (!endpointResult.ok) return endpointResult;

    // Prompt for region (optional)
    const regionOp = new InputTextOp('Enter AWS Region (optional, default: ap-northeast-1):', {
      cancelable: this.options.cancelable ?? true,
      placeholder: 'ap-northeast-1',
      initialValue: this.options.defaults?.region || 'ap-northeast-1',
    });

    const regionResult = await regionOp.run(io);
    if (!regionResult.ok) return regionResult;

    const credentials: S3Credentials = {
      accessKeyId: accessKeyIdResult.value,
      secretAccessKey: secretAccessKeyResult.value,
      endpoint: endpointResult.value || undefined,
      region: regionResult.value || 'ap-northeast-1',
      bucket: this.options.bucket,
    };

    return this.succeed(credentials);
  }

  /**
   * Try to get credentials from environment variables
   */
  private getCredentialsFromEnv(): S3Credentials | null
  {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey)
    {
      return null;
    }

    const endpoint = process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT;
    const region = process.env.AWS_REGION || process.env.S3_REGION || 'ap-northeast-1';

    return {
      accessKeyId,
      secretAccessKey,
      endpoint,
      region,
      bucket: this.options.bucket,
    };
  }
}

// CLI support - runnable as standalone program
if (import.meta.main)
{
  console.log('🔐 S3CredentialsOp Demo\n');

  const args = Bun.argv.slice(2);
  const bucket = args[0] || 'test-bucket';

  console.log(`Getting credentials for bucket: ${bucket}\n`);

  // Test 1: Try to get credentials (will use env vars if available)
  const op1 = new S3CredentialsOp({ bucket });
  const result1 = await op1.run();

  if (result1.ok)
  {
    const creds = result1.value;
    console.log('✅ Credentials obtained:');
    console.log(`   Access Key ID: ${creds.accessKeyId.substring(0, 8)}...`);
    console.log(`   Secret Key: ${creds.secretAccessKey.substring(0, 8)}...`);
    console.log(`   Endpoint: ${creds.endpoint || '(default)'}`);
    console.log(`   Region: ${creds.region}`);
    console.log(`   Bucket: ${creds.bucket}`);

    // Test 2: Force prompt (uncomment to test interactively)
    // console.log('\n\n🧪 Testing force prompt mode...');
    // const op2 = new S3CredentialsOp({ bucket: 'another-bucket', forcePrompt: true });
    // const result2 = await op2.run();
    // if (result2.ok) {
    //   console.log('✅ Force prompt worked');
    // }
  }
  else if (result1.failure === 'canceled')
  {
    console.log('🚫 User canceled credential input');
  }
  else
  {
    console.error('❌ Error:', result1.failure);
    process.exit(1);
  }

  console.log('\n✨ Demo complete!');
}
