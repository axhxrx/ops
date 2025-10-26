/**
 Cross-runtime utilities for Bun and Deno compatibility

 This module provides helper functions that work across both Bun and Deno using Node.js compatibility APIs.
 */

import { Buffer } from 'node:buffer';
import { execSync } from 'node:child_process';
import process from 'node:process';

/**
 Detect which runtime we're running on

 Useful for debugging and runtime-specific optimizations
 */
export function getRuntime(): 'bun' | 'deno' | 'node' | 'unknown'
{
  if (typeof Bun !== 'undefined') return 'bun';
  // @ts-expect-error - Deno global exists in Deno
  if (typeof Deno !== 'undefined') return 'deno';
  if (typeof process !== 'undefined' && process.versions?.node) return 'node';
  return 'unknown';
}

/**
 Find an executable in PATH (cross-runtime equivalent of Bun.which())

 @param command - Command name to search for
 @returns Full path to the executable, or null if not found

 @example
 ```typescript
 const vimPath = which('vim');
 if (vimPath) {
   console.log('Vim found at:', vimPath);
 }
 ```
 */
export function which(command: string): string | null
{
  try
  {
    // Use the system's 'which' command (Unix) or 'where' command (Windows)
    const isWindows = process.platform === 'win32';
    const whichCmd = isWindows ? 'where' : 'which';

    const result = execSync(`${whichCmd} ${command}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
    }).trim();

    // On Windows, 'where' can return multiple paths - take the first one
    if (isWindows && result.includes('\n'))
    {
      return result.split('\n')[0]!.trim();
    }

    return result || null;
  }
  catch
  {
    // Command not found
    return null;
  }
}

/**
 Read all input from stdin as text (cross-runtime equivalent of Bun.stdin.text())

 @returns Promise that resolves with stdin content as a string

 @example
 ```typescript
 const input = await readStdin();
 console.log('You entered:', input);
 ```
 */
export function readStdin(): Promise<string>
{
  return new Promise((resolve, reject) =>
  {
    const chunks: Buffer[] = [];

    process.stdin.on('data', (chunk: Buffer) =>
    {
      chunks.push(chunk);
    });

    process.stdin.on('end', () =>
    {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });

    process.stdin.on('error', (error) =>
    {
      reject(error);
    });

    // Resume stdin to start reading
    process.stdin.resume();
  });
}
