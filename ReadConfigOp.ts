#!/usr/bin/env bun

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getConfigNamespace, sanitizeKey, sanitizeNamespace } from './ConfigContext.ts';
import type { IOContext } from './IOContext.ts';
import { JSONCTCParseOp } from './JSONCTCParseOp.ts';
import { Op } from './Op.ts';
import type { Failure, Success } from './Outcome.ts';

/**
 Options for reading config
 */
export interface ReadConfigOptions
{
  /**
   Namespace for the config file. Defaults to global namespace set via setConfigNamespace().

   @example 'my-app', 'com.axhxrx.ops.filepicker'
   */
  namespace?: string;

  /**
   Default value to return if config is not found

   If specified, 'notFound' failure becomes a success with defaultValue
   */
  defaultValue?: unknown;
}

/**
 Read a config value from the nearest config directory

 Resolution order:
 1. Walk up from CWD looking for .config/<namespace>/<key>.jsonctc
 2. Stop at volume boundary
 3. Fall back to ~/.config/<namespace>/<key>.jsonctc
 4. If defaultValue specified, return it
 5. Otherwise fail with 'notFound'

 @example
 ```typescript
 // Read with default
 const op = new ReadConfigOp<string>('ui-language', {
   namespace: 'my-app',
   defaultValue: 'en-US'
 });
 const result = await op.run();
 if (result.ok) {
   console.log(`Language: ${result.value}`);
 }

 // Read array
 const urlsOp = new ReadConfigOp<string[]>('recent-urls', {
   defaultValue: []
 });
 ```
 */
export class ReadConfigOp<T = unknown> extends Op
{
  name = 'ReadConfigOp';

  constructor(
    private key: string,
    private options?: ReadConfigOptions,
  )
  {
    super();
  }

  async run(_io?: IOContext): Promise<
    | Success<T>
    | Failure<'notFound' | 'parseError' | 'accessDenied'>
  >
  {
    await Promise.resolve();

    const namespace = this.options?.namespace
      ? sanitizeNamespace(this.options.namespace)
      : getConfigNamespace();
    const key = sanitizeKey(this.key);

    // Find config file
    const configPath = this.findConfigFile(namespace, key);

    if (!configPath)
    {
      // Not found - check for default value
      if (this.options?.defaultValue !== undefined)
      {
        return this.succeed(this.options.defaultValue as T);
      }
      return this.fail(
        'notFound' as const,
        `Config not found: ${namespace}/${key}.jsonctc`,
      );
    }

    // Read and parse file with JSONCTC parser
    try
    {
      const content = fs.readFileSync(configPath, 'utf-8');

      // Use JSONCTC parser to support comments and trailing commas
      const parseOp = new JSONCTCParseOp<T>(content);
      const parseResult = await parseOp.run();

      if (!parseResult.ok)
      {
        return this.fail('parseError' as const, `${parseResult.debugData || 'Parse error'}: ${configPath}`);
      }

      return this.succeed(parseResult.value);
    }
    catch (error: unknown)
    {
      if (error && typeof error === 'object' && 'code' in error)
      {
        const code = (error as { code: string }).code;
        if (code === 'EACCES' || code === 'EPERM')
        {
          return this.fail('accessDenied' as const, `Cannot read: ${configPath}`);
        }
      }

      return this.fail('parseError' as const, String(error));
    }
  }

  /**
   Find config file by walking up directory tree

   @param namespace - Sanitized namespace
   @param key - Sanitized key
   @returns Path to config file, or null if not found
   */
  private findConfigFile(namespace: string, key: string): string | null
  {
    const filename = `${key}.jsonctc`;

    // 1. Walk up from CWD
    const cwdResult = this.walkUpFromCwd(namespace, filename);
    if (cwdResult) return cwdResult;

    // 2. Check home directory
    const homeDir = os.homedir();
    const homePath = path.join(homeDir, '.config', namespace, filename);
    if (fs.existsSync(homePath)) return homePath;

    // Not found
    return null;
  }

  /**
   Walk up from CWD looking for config file, stopping at volume boundary

   @param namespace - Sanitized namespace
   @param filename - Config filename (e.g., 'ui-language.jsonctc')
   @returns Path to config file, or null if not found
   */
  private walkUpFromCwd(namespace: string, filename: string): string | null
  {
    let currentDir = process.cwd();
    const cwdRoot = path.parse(currentDir).root;

    while (true)
    {
      // Check for .config/<namespace>/<filename> in current directory
      const configPath = path.join(currentDir, '.config', namespace, filename);
      if (fs.existsSync(configPath))
      {
        return configPath;
      }

      // Move to parent directory
      const parentDir = path.dirname(currentDir);

      // Stop if we've reached the root or can't go further
      if (parentDir === currentDir) break;

      // Stop if we've crossed volume boundary
      const parentRoot = path.parse(parentDir).root;
      if (parentRoot !== cwdRoot) break;

      currentDir = parentDir;
    }

    return null;
  }
}

// CLI support
if (import.meta.main)
{
  const args = process.argv.slice(2);

  if (args.length < 1)
  {
    console.error('Usage: bun ReadConfigOp.ts <key> [namespace]');
    console.error('');
    console.error('Examples:');
    console.error('  bun ReadConfigOp.ts ui-language');
    console.error('  bun ReadConfigOp.ts ui-language my-app');
    process.exit(1);
  }

  const key = args[0]!;
  const namespace = args[1];

  const op = new ReadConfigOp(key, namespace ? { namespace } : undefined);
  const result = await op.run();

  if (result.ok)
  {
    console.log(JSON.stringify(result.value, null, 2));
  }
  else
  {
    console.error(`Error: ${result.failure}`);
    if (result.debugData)
    {
      console.error(result.debugData);
    }
    process.exit(1);
  }
}
