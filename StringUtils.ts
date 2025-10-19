#!/usr/bin/env bun

import stringWidth from 'string-width';

/**
 * String utilities for terminal display
 *
 * These utilities handle the complexity of full-width characters (CJK)
 * which take 2 terminal columns but count as 1 in JavaScript's .length
 */

/**
 * Get the actual terminal display width of a string
 *
 * Handles full-width (CJK) characters correctly
 *
 * @example
 * ```typescript
 * getDisplayWidth('hello');     // 5
 * getDisplayWidth('データ');     // 6 (3 chars × 2 columns each)
 * getDisplayWidth('データ.txt'); // 10 (6 + 4)
 * ```
 */
export function getDisplayWidth(str: string): number
{
  return stringWidth(str);
}

/**
 * Truncate string to fit terminal width, adding ellipsis if needed
 *
 * Properly handles full-width characters
 *
 * @param str - String to truncate
 * @param maxWidth - Maximum display width in terminal columns
 * @returns Truncated string with ellipsis if needed
 *
 * @example
 * ```typescript
 * truncateToWidth('hello world', 8);  // 'hello...'
 * truncateToWidth('データファイル', 8); // 'データ...' (4 + 3 = 7 columns)
 * ```
 */
export function truncateToWidth(str: string, maxWidth: number): string
{
  const currentWidth = stringWidth(str);

  // No truncation needed
  if (currentWidth <= maxWidth)
  {
    return str;
  }

  // Need to truncate - reserve 3 columns for ellipsis
  const targetWidth = maxWidth - 3;
  if (targetWidth <= 0)
  {
    return '...';
  }

  // Find the right substring length
  // We can't just use substring because of full-width chars
  let result = '';
  let width = 0;

  for (const char of str)
  {
    const charWidth = stringWidth(char);
    if (width + charWidth > targetWidth)
    {
      break;
    }
    result += char;
    width += charWidth;
  }

  return result + '...';
}

/**
 * Pad string to exact terminal width
 *
 * Handles full-width characters correctly
 *
 * @param str - String to pad
 * @param targetWidth - Target display width in terminal columns
 * @param align - Alignment ('left', 'right', 'center')
 * @returns Padded string
 */
export function padToWidth(
  str: string,
  targetWidth: number,
  align: 'left' | 'right' | 'center' = 'left',
): string
{
  const currentWidth = stringWidth(str);

  if (currentWidth >= targetWidth)
  {
    return str;
  }

  const padding = targetWidth - currentWidth;

  switch (align)
  {
    case 'left':
      return str + ' '.repeat(padding);
    case 'right':
      return ' '.repeat(padding) + str;
    case 'center':
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
  }
}

// CLI support - runnable as standalone program for testing
if (import.meta.main)
{
  console.log('📏 StringUtils Demo\n');

  // Test 1: Display width
  console.log('Test 1: Display Width');
  const testStrings = [
    'hello',
    'データ',
    'データ.txt',
    '日本語ファイル名.pdf',
    'mixed英語日本語.txt',
  ];

  for (const str of testStrings)
  {
    const jsLength = str.length;
    const displayWidth = getDisplayWidth(str);
    console.log(`  "${str}"`);
    console.log(`    JS length: ${jsLength}, Display width: ${displayWidth}`);
  }

  // Test 2: Truncation
  console.log('\nTest 2: Truncation');
  const longStrings = [
    { str: 'very long filename.txt', maxWidth: 15 },
    { str: '非常に長い日本語のファイル名.txt', maxWidth: 15 },
    { str: 'mixed長いファイル名withEnglish.pdf', maxWidth: 20 },
  ];

  for (const { str, maxWidth } of longStrings)
  {
    const truncated = truncateToWidth(str, maxWidth);
    const width = getDisplayWidth(truncated);
    console.log(`  Original: "${str}" (width: ${getDisplayWidth(str)})`);
    console.log(`  Truncated to ${maxWidth}: "${truncated}" (width: ${width})`);
  }

  // Test 3: Padding
  console.log('\nTest 3: Padding');
  const paddingTests = [
    { str: 'left', width: 20, align: 'left' as const },
    { str: 'right', width: 20, align: 'right' as const },
    { str: 'center', width: 20, align: 'center' as const },
    { str: 'データ', width: 20, align: 'left' as const },
  ];

  for (const { str, width, align } of paddingTests)
  {
    const padded = padToWidth(str, width, align);
    console.log(`  "${str}" (${align}, ${width}): |${padded}| (width: ${getDisplayWidth(padded)})`);
  }

  console.log('\n✨ All tests complete!');
}
