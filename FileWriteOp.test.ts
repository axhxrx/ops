import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { FileWriteOp } from './FileWriteOp';
import { JSONCTCObject } from './JSONCTCObject';

describe('FileWriteOp', () =>
{
  const testDir = path.join(os.tmpdir(), 'filewriteop-test');

  beforeEach(() =>
  {
    // Create test directory
    if (!fs.existsSync(testDir))
    {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() =>
  {
    // Clean up test directory
    try
    {
      if (fs.existsSync(testDir))
      {
        fs.rmSync(testDir, { recursive: true });
      }
    }
    catch
    {
      // Ignore cleanup errors
    }
  });

  test('writes string content to file', async () =>
  {
    const filePath = path.join(testDir, 'test.txt');
    const content = 'Hello, world!';

    const op = new FileWriteOp(filePath, content);
    const result = await op.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      expect(result.value).toBe(filePath);
    }

    // Verify file was created with correct content
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toBe(content);
  });

  test('writes object with toString() method', async () =>
  {
    const filePath = path.join(testDir, 'test-object.json');

    // Create object with toString()
    const obj = {
      data: { foo: 'bar', count: 42 },
      toString()
      {
        return JSON.stringify(this.data, null, 2);
      },
    };

    const op = new FileWriteOp(filePath, obj);
    const result = await op.run();

    expect(result.ok).toBe(true);

    // Verify toString() was called and content written
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toContain('"foo": "bar"');
    expect(fileContent).toContain('"count": 42');

    // Verify it's valid JSON
    const parsed = JSON.parse(fileContent);
    expect(parsed.foo).toBe('bar');
    expect(parsed.count).toBe(42);
  });

  test('uses atomic write pattern', async () =>
  {
    const filePath = path.join(testDir, 'test-atomic.txt');
    const content = 'Atomic write test';

    const op = new FileWriteOp(filePath, content);
    const result = await op.run();

    expect(result.ok).toBe(true);

    // Verify no temp files left behind
    const files = fs.readdirSync(testDir);
    const tempFiles = files.filter(f => f.includes('.tmp.'));
    expect(tempFiles.length).toBe(0);

    // Verify file was written
    expect(fs.existsSync(filePath)).toBe(true);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toBe(content);
  });

  test('creates parent directory if missing', async () =>
  {
    const nestedPath = path.join(testDir, 'nested', 'deep', 'directory', 'test.txt');
    const content = 'Nested file content';

    const op = new FileWriteOp(nestedPath, content);
    const result = await op.run();

    expect(result.ok).toBe(true);

    // Verify directory structure was created
    expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);

    // Verify file was written
    const fileContent = fs.readFileSync(nestedPath, 'utf-8');
    expect(fileContent).toBe(content);
  });

  test('overwrites existing file', async () =>
  {
    const filePath = path.join(testDir, 'test-overwrite.txt');

    // Write initial content
    const op1 = new FileWriteOp(filePath, 'Original content');
    const result1 = await op1.run();
    expect(result1.ok).toBe(true);

    // Verify initial content
    let fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toBe('Original content');

    // Overwrite with new content
    const op2 = new FileWriteOp(filePath, 'Updated content');
    const result2 = await op2.run();
    expect(result2.ok).toBe(true);

    // Verify content was overwritten
    fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toBe('Updated content');
  });

  test('handles empty string content', async () =>
  {
    const filePath = path.join(testDir, 'test-empty.txt');
    const content = '';

    const op = new FileWriteOp(filePath, content);
    const result = await op.run();

    expect(result.ok).toBe(true);

    // Verify empty file was created
    expect(fs.existsSync(filePath)).toBe(true);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toBe('');
  });

  test('handles multiline content', async () =>
  {
    const filePath = path.join(testDir, 'test-multiline.txt');
    const content = `Line 1
Line 2
Line 3
Line 4`;

    const op = new FileWriteOp(filePath, content);
    const result = await op.run();

    expect(result.ok).toBe(true);

    // Verify multiline content preserved
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toBe(content);

    const lines = fileContent.split('\n');
    expect(lines.length).toBe(4);
    expect(lines[0]).toBe('Line 1');
    expect(lines[3]).toBe('Line 4');
  });

  test('handles unicode content', async () =>
  {
    const filePath = path.join(testDir, 'test-unicode.txt');
    const content = 'Hello 世界! 🌍 Привет мир!';

    const op = new FileWriteOp(filePath, content);
    const result = await op.run();

    expect(result.ok).toBe(true);

    // Verify unicode content preserved
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toBe(content);
    expect(fileContent).toContain('世界');
    expect(fileContent).toContain('🌍');
    expect(fileContent).toContain('Привет');
  });

  test('works with object that has complex toString()', async () =>
  {
    const filePath = path.join(testDir, 'test-complex-tostring.txt');

    // Create object with complex toString() implementation
    const obj = {
      title: 'My Document',
      lines: ['First line', 'Second line', 'Third line'],
      metadata: { author: 'Alice', date: '2025-10-16' },
      toString()
      {
        const header = `# ${this.title}\n\n`;
        const meta = `Author: ${this.metadata.author}\nDate: ${this.metadata.date}\n\n`;
        const body = this.lines.join('\n');
        return header + meta + body;
      },
    };

    const op = new FileWriteOp(filePath, obj);
    const result = await op.run();

    expect(result.ok).toBe(true);

    // Verify complex toString() output was written correctly
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toContain('# My Document');
    expect(fileContent).toContain('Author: Alice');
    expect(fileContent).toContain('Date: 2025-10-16');
    expect(fileContent).toContain('First line');
    expect(fileContent).toContain('Second line');
    expect(fileContent).toContain('Third line');
  });

  test('cleans up temp file on write error', async () =>
  {
    // Try to write to an invalid location
    // Use a path that will fail during rename (not mkdir)
    const invalidPath = path.join(testDir, 'test-file.txt');

    // First create the file
    fs.writeFileSync(invalidPath, 'initial', 'utf-8');

    // Now make it read-only
    fs.chmodSync(invalidPath, 0o444);

    // Try to write (this should fail during rename on some systems)
    const op = new FileWriteOp(invalidPath, 'new content');
    const result = await op.run();

    // This might succeed on some systems, but if it fails...
    if (!result.ok)
    {
      // Verify no temp files left behind
      const files = fs.readdirSync(testDir);
      const tempFiles = files.filter(f => f.includes('.tmp.'));
      expect(tempFiles.length).toBe(0);
    }

    // Clean up
    try
    {
      fs.chmodSync(invalidPath, 0o644);
      fs.unlinkSync(invalidPath);
    }
    catch
    {
      // Ignore
    }
  });

  test('integration: works with JSONCTCObject-like object', async () =>
  {
    const filePath = path.join(testDir, 'test-jsonctc-like.jsonctc');

    // Simulate a JSONCTCObject with toString() that preserves comments
    const jsonctcLike = {
      rawText: `{
  // This is a comment
  "foo": "bar",
  "count": 42
}`,
      toString()
      {
        return this.rawText;
      },
    };

    const op = new FileWriteOp(filePath, jsonctcLike);
    const result = await op.run();

    expect(result.ok).toBe(true);

    // Verify the toString() method was called and content preserved
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toContain('// This is a comment');
    expect(fileContent).toContain('"foo": "bar"');
    expect(fileContent).toContain('"count": 42');
  });

  test('returns correct file path on success', async () =>
  {
    const filePath = path.join(testDir, 'test-return-path.txt');
    const content = 'Testing return value';

    const op = new FileWriteOp(filePath, content);
    const result = await op.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      expect(result.value).toBe(filePath);
      expect(path.isAbsolute(result.value)).toBe(true);
    }
  });

  test('handles very long file paths', async () =>
  {
    // Create a deep directory structure
    const deepPath = path.join(
      testDir,
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'test-deep.txt',
    );
    const content = 'Deep file';

    const op = new FileWriteOp(deepPath, content);
    const result = await op.run();

    expect(result.ok).toBe(true);

    // Verify file was created
    expect(fs.existsSync(deepPath)).toBe(true);
    const fileContent = fs.readFileSync(deepPath, 'utf-8');
    expect(fileContent).toBe(content);
  });

  test('handles special characters in filename', async () =>
  {
    const filePath = path.join(testDir, 'test-file-with-special-chars (copy) [2].txt');
    const content = 'Special chars in filename';

    const op = new FileWriteOp(filePath, content);
    const result = await op.run();

    expect(result.ok).toBe(true);

    // Verify file was created
    expect(fs.existsSync(filePath)).toBe(true);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toBe(content);
  });

  test('concurrent writes to different files', async () =>
  {
    const filePath1 = path.join(testDir, 'concurrent1.txt');
    const filePath2 = path.join(testDir, 'concurrent2.txt');
    const filePath3 = path.join(testDir, 'concurrent3.txt');

    const op1 = new FileWriteOp(filePath1, 'Content 1');
    const op2 = new FileWriteOp(filePath2, 'Content 2');
    const op3 = new FileWriteOp(filePath3, 'Content 3');

    // Run all operations concurrently
    const results = await Promise.all([
      op1.run(),
      op2.run(),
      op3.run(),
    ]);

    // Verify all succeeded
    expect(results[0]!.ok).toBe(true);
    expect(results[1]!.ok).toBe(true);
    expect(results[2]!.ok).toBe(true);

    // Verify all files have correct content
    expect(fs.readFileSync(filePath1, 'utf-8')).toBe('Content 1');
    expect(fs.readFileSync(filePath2, 'utf-8')).toBe('Content 2');
    expect(fs.readFileSync(filePath3, 'utf-8')).toBe('Content 3');
  });

  test('integration: works with real JSONCTCObject', async () =>
  {
    const filePath = path.join(testDir, 'test-real-jsonctc.jsonctc');

    // Create a JSONCTCObject with comments
    const jsonctcText = `{
  // User configuration
  "name": "Alice",
  // Contact info
  "email": "alice@example.com",
  "age": 30
}`;

    const jsonctc = new JSONCTCObject(jsonctcText);

    // Modify some values
    jsonctc.data.name = 'Bob';
    jsonctc.data.age = 35;

    // Write using FileWriteOp
    const op = new FileWriteOp(filePath, jsonctc);
    const result = await op.run();

    expect(result.ok).toBe(true);

    // Verify the file was written with comments preserved
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toContain('// User configuration');
    expect(fileContent).toContain('// Contact info');
    expect(fileContent).toContain('"name": "Bob"');
    expect(fileContent).toContain('"age": 35');
    expect(fileContent).toContain('"email": "alice@example.com"');
  });

  test('integration: JSONCTCObject without original text', async () =>
  {
    const filePath = path.join(testDir, 'test-jsonctc-no-original.json');

    // Create JSONCTCObject from plain object (no original text)
    const jsonctc = new JSONCTCObject({ foo: 'bar', count: 42 });

    // Write using FileWriteOp
    const op = new FileWriteOp(filePath, jsonctc);
    const result = await op.run();

    expect(result.ok).toBe(true);

    // Verify it wrote valid JSON
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    expect(parsed.foo).toBe('bar');
    expect(parsed.count).toBe(42);
  });
});
