#!/usr/bin/env bun

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getConfigNamespace, sanitizeKey, sanitizeNamespace } from './ConfigContext.ts';
import { FileWriteOp } from './FileWriteOp.ts';
import type { IOContext } from './IOContext.ts';
import { JSONCTCObject } from './JSONCTCObject.ts';
import { JSONCTCReadFileOp } from './JSONCTCReadFileOp.ts';
import { Op } from './Op.ts';

/**
 Options for writing config
 */
export interface WriteConfigOptions
{
  /**
   Namespace for the config file. Defaults to global namespace set via setConfigNamespace().

   @example 'my-app', 'com.axhxrx.ops.filepicker'
   */
  namespace?: string;

  /**
   Pretty-print the JSON output. Default: true
   */
  pretty?: boolean;
}

/**
 Write a config value to the appropriate config directory

 JSONCTC PRESERVATION: If the config file already exists, this Op uses JSONCTCObject to update values while preserving:
 - Comments (//, /* *\/)
 - Trailing commas
 - Original formatting and indentation

 Write strategy:
 1. If config already exists: Read with JSONCTCReadFileOp, modify obj.data properties, write with FileWriteOp (preserves comments!)
 2. If new file: Create JSONCTCObject from value, write with FileWriteOp
 3. Write to nearest .config/<namespace>/<key>.jsonctc (walk-up logic)
 4. FileWriteOp handles atomic writes (temp file + rename)

 @example
 ```typescript
 // Write string value
 const op = new WriteConfigOp('ui-language', 'en-US', {
   namespace: 'my-app'
 });
 const result = await op.run();
 if (result.ok) {
   console.log(`Wrote to: ${result.value}`);
 }

 // If file exists with comments:
 // // User's preferred language
 // "en-GB"
 //
 // After write, comments are preserved:
 // // User's preferred language
 // "en-US"

 // Write object (preserves comments on individual properties!)
 const configOp = new WriteConfigOp('settings', {
   theme: 'dark',
   fontSize: 14
 });
 ```
 */
export class WriteConfigOp<T = unknown> extends Op
{
  name = 'WriteConfigOp';

  constructor(
    private key: string,
    private value: T,
    private options?: WriteConfigOptions,
  )
  {
    super();
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();

    const namespace = this.options?.namespace
      ? sanitizeNamespace(this.options.namespace)
      : getConfigNamespace();
    const key = sanitizeKey(this.key);

    // Determine where to write
    const targetPath = this.determineWritePath(namespace, key);

    // Create JSONCTCObject with the new value
    let jsonctcObj: JSONCTCObject;

    // Try to read existing file to preserve comments
    const readOp = new JSONCTCReadFileOp(targetPath);
    const readResult = await readOp.run(io);

    if (readResult.ok)
    {
      // File exists - preserve comments by updating properties individually
      const existingObj = readResult.value;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Intentional: .data returns any (dynamic proxy)
      const existingData = existingObj.data;

      // Check if both old and new values are plain objects (not arrays)
      const isPlainObject = (val: unknown): val is Record<string, unknown> =>
        val !== null && typeof val === 'object' && !Array.isArray(val) && val.constructor === Object;

      if (isPlainObject(this.value) && isPlainObject(existingData))
      {
        // Both are plain objects - RECURSIVELY update to preserve nested comments!
        jsonctcObj = existingObj;
        this.recursivelyUpdateProperties(jsonctcObj.data, this.value);
      }
      else if (Array.isArray(this.value) && Array.isArray(existingData))
      {
        // Both are arrays - update element-by-element to preserve comments!
        jsonctcObj = existingObj;
        const newArray = this.value as unknown[];
        const oldArray = existingData as unknown[];

        // Update each element
        const maxLen = Math.max(newArray.length, oldArray.length);
        for (let i = 0; i < maxLen; i++)
        {
          if (i < newArray.length)
          {
            // Set the element (will trigger our monkeypatch!)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Intentional: array element access on dynamic proxy
            jsonctcObj.data[String(i)] = newArray[i];
          }
          else
          {
            // Delete extra elements
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Intentional: array element access on dynamic proxy
            delete jsonctcObj.data[String(i)];
          }
        }
      }
      else
      {
        // Type mismatch (object → array, array → object, etc.)
        // Replace entire value - can't preserve comments in this case
        // For primitives, stringify then wrap
        const pretty = this.options?.pretty ?? true;
        const jsonText = pretty
          ? JSON.stringify(this.value, null, 2) + '\n'
          : JSON.stringify(this.value);
        jsonctcObj = new JSONCTCObject(jsonText);
      }
    }
    else if (readResult.failure === 'fileNotFound')
    {
      // File doesn't exist - create new JSONCTCObject
      // For primitives or non-objects, stringify first then parse
      const pretty = this.options?.pretty ?? true;
      const jsonText = pretty
        ? JSON.stringify(this.value, null, 2) + '\n'
        : JSON.stringify(this.value);
      jsonctcObj = new JSONCTCObject(jsonText);
    }
    else
    {
      // Other read errors (permission, parse error, etc.)
      return this.fail(readResult.failure, readResult.debugData);
    }

    // Write using FileWriteOp (handles atomic write, directory creation, etc.)
    const writeOp = new FileWriteOp(targetPath, jsonctcObj);
    const writeResult = await writeOp.run(io);

    if (!writeResult.ok)
    {
      return this.fail(writeResult.failure, writeResult.debugData);
    }

    return this.succeed(writeResult.value);
  }

  /**
   * Recursively update properties in a JSONCTCObject from a plain object
   *
   * This preserves nested comments by updating properties individually
   * instead of replacing entire nested objects.
   *
   * @param target - The JSONCTCObject's .data proxy to update
   * @param source - The plain object with new values
   */
  private recursivelyUpdateProperties(
    target: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    source: Record<string, unknown>,
  ): void
  {
    // NOTE: This function intentionally works with 'any' (the dynamic proxy from JSONCTCObject.data)
    // We use type guards to safely navigate the structure, but ESLint doesn't understand this pattern.

    // Helper to check if value is a plain object (not array, not null)
    const isPlainObject = (val: unknown): val is Record<string, unknown> =>
      val !== null
      && typeof val === 'object'
      && !Array.isArray(val)
      && val.constructor === Object;

    // Get keys from both target and source
    const sourceKeys = Object.keys(source);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Intentional: target is dynamic proxy
    const targetKeys = Object.keys(target);

    // Update or add properties from source
    for (const key of sourceKeys)
    {
      const sourceValue = source[key];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Intentional: dynamic proxy access
      const targetValue = target[key];

      // If BOTH are plain objects, recurse!
      if (isPlainObject(sourceValue) && isPlainObject(targetValue))
      {
        this.recursivelyUpdateProperties(targetValue, sourceValue);
      }
      else
      {
        // Otherwise, just set the value (primitive or type mismatch)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Intentional: dynamic proxy mutation
        target[key] = sourceValue;
      }
    }

    // Delete properties that exist in target but not in source
    for (const key of targetKeys)
    {
      if (!sourceKeys.includes(key))
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Intentional: dynamic proxy mutation
        delete target[key];
      }
    }
  }

  /**
   Determine where to write the config file

   Strategy:
   1. If file already exists (walk up from CWD), write there
   2. Otherwise, write to ~/.config/<namespace>/<key>.jsonctc

   @param namespace - Sanitized namespace
   @param key - Sanitized key
   @returns Path where config should be written
   */
  private determineWritePath(namespace: string, key: string): string
  {
    const filename = `${key}.jsonctc`;

    // Check if config already exists via walk-up
    const existingPath = this.findExistingConfig(namespace, filename);
    if (existingPath) return existingPath;

    // Default to home directory
    const homeDir = os.homedir();
    return path.join(homeDir, '.config', namespace, filename);
  }

  /**
   Find existing config file by walking up directory tree

   @param namespace - Sanitized namespace
   @param filename - Config filename
   @returns Path to existing config file, or null if not found
   */
  private findExistingConfig(namespace: string, filename: string): string | null
  {
    // Walk up from CWD
    let currentDir = process.cwd();
    const cwdRoot = path.parse(currentDir).root;

    while (true)
    {
      const configPath = path.join(currentDir, '.config', namespace, filename);
      if (fs.existsSync(configPath))
      {
        return configPath;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break;

      const parentRoot = path.parse(parentDir).root;
      if (parentRoot !== cwdRoot) break;

      currentDir = parentDir;
    }

    // Check home directory
    const homeDir = os.homedir();
    const homePath = path.join(homeDir, '.config', namespace, filename);
    if (fs.existsSync(homePath)) return homePath;

    return null;
  }
}

// CLI support
if (import.meta.main)
{
  const args = process.argv.slice(2);

  if (args.length < 2)
  {
    console.error('Usage: bun WriteConfigOp.ts <key> <value> [namespace]');
    console.error('');
    console.error('Examples:');
    console.error('  bun WriteConfigOp.ts ui-language en-US');
    console.error('  bun WriteConfigOp.ts ui-language en-US my-app');
    console.error('  bun WriteConfigOp.ts recent-urls \'["https://example.com"]\'');
    process.exit(1);
  }

  const key = args[0]!;
  const valueStr = args[1]!;
  const namespace = args[2];

  // Try to parse value as JSON, fall back to string
  let value: unknown;
  try
  {
    value = JSON.parse(valueStr);
  }
  catch
  {
    value = valueStr;
  }

  const op = new WriteConfigOp(key, value, namespace ? { namespace } : undefined);
  const result = await op.run();

  if (result.ok)
  {
    console.log(`✓ Wrote to: ${result.value}`);
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
