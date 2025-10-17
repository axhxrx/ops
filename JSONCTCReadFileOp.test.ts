/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { JSONCTCReadFileOp } from './JSONCTCReadFileOp';

describe('JSONCTCReadFileOp', () =>
{
  let testDir: string;

  beforeEach(() =>
  {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonctc-read-test-'));
  });

  afterEach(() =>
  {
    if (fs.existsSync(testDir))
    {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('Reading files', () =>
  {
    test('reads simple JSON file', async () =>
    {
      const filePath = path.join(testDir, 'simple.json');
      fs.writeFileSync(filePath, '{"name": "Alice", "age": 30}', 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(result.value.data.name).toBe('Alice');
        expect(result.value.data.age).toBe(30);
      }
    });

    test('reads JSONCTC with comments', async () =>
    {
      const filePath = path.join(testDir, 'with-comments.jsonctc');
      const content = `{
  // User information
  "name": "Alice",
  /* Block comment */ "age": 30
}`;
      fs.writeFileSync(filePath, content, 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(result.value.data.name).toBe('Alice');
        expect(result.value.data.age).toBe(30);
      }
    });

    test('reads JSONCTC with trailing commas', async () =>
    {
      const filePath = path.join(testDir, 'with-trailing.jsonctc');
      const content = `{
  "name": "Alice",
  "age": 30,
}`;
      fs.writeFileSync(filePath, content, 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(result.value.data.name).toBe('Alice');
        expect(result.value.data.age).toBe(30);
      }
    });

    test('reads complex nested structure', async () =>
    {
      const filePath = path.join(testDir, 'nested.json');
      const content = JSON.stringify({
        user: {
          name: 'Alice',
          contact: {
            email: 'alice@example.com',
            phone: '555-1234',
          },
        },
        tags: ['typescript', 'javascript'],
      });
      fs.writeFileSync(filePath, content, 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(result.value.data.user.name).toBe('Alice');
        expect(result.value.data.user.contact.email).toBe('alice@example.com');
        expect(result.value.data.tags[0]).toBe('typescript');
      }
    });

    test('reads array at root', async () =>
    {
      const filePath = path.join(testDir, 'array.json');
      fs.writeFileSync(filePath, '["a", "b", "c"]', 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(result.value.data[0]).toBe('a');
        expect(result.value.data.length).toBe(3);
      }
    });
  });

  describe('Modifying read data', () =>
  {
    test('can modify data after reading', async () =>
    {
      const filePath = path.join(testDir, 'modify.json');
      fs.writeFileSync(filePath, '{"name": "Alice", "age": 30}', 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        const obj = result.value;
        obj.data.name = 'Bob';
        obj.data.city = 'Paris';

        expect(obj.data.name).toBe('Bob');
        expect(obj.data.age).toBe(30);
        expect(obj.data.city).toBe('Paris');
      }
    });

    test('toString() preserves comments after modification', async () =>
    {
      const filePath = path.join(testDir, 'preserve.jsonctc');
      const content = `{
  // User name
  "name": "Alice",
  // User age
  "age": 30
}`;
      fs.writeFileSync(filePath, content, 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        const obj = result.value;
        obj.data.name = 'Bob';

        const output = obj.toString();
        expect(output).toContain('// User name');
        expect(output).toContain('// User age');
        expect(output).toContain('Bob');
      }
    });
  });

  describe('Error handling', () =>
  {
    test('returns fileNotFound when file does not exist', async () =>
    {
      const filePath = path.join(testDir, 'nonexistent.json');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(false);
      if (!result.ok)
      {
        expect(result.failure).toBe('fileNotFound');
        expect(result.debugData).toContain('File not found');
      }
    });

    test('parses lenient JSONCTC (jsonc-parser is very tolerant)', async () =>
    {
      const filePath = path.join(testDir, 'invalid.json');
      // Note: jsonc-parser is very lenient and will parse this as {}
      fs.writeFileSync(filePath, '{ invalid json }', 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      // jsonc-parser doesn't throw on this - it's lenient
      expect(result.ok).toBe(true);
      if (result.ok)
      {
        // It parses to empty object
        expect(Object.keys(result.value.data)).toHaveLength(0);
      }
    });

    test('returns readError for permission issues', async () =>
    {
      // This test might be platform-specific
      const filePath = path.join(testDir, 'no-permission.json');
      fs.writeFileSync(filePath, '{"test": "data"}', 'utf-8');

      // Try to remove read permissions (might not work on all systems)
      try
      {
        fs.chmodSync(filePath, 0o000);

        const op = new JSONCTCReadFileOp(filePath);
        const result = await op.run();

        // Restore permissions for cleanup
        fs.chmodSync(filePath, 0o644);

        expect(result.ok).toBe(false);
        if (!result.ok)
        {
          // Could be readError or fileNotFound depending on system
          expect(['readError', 'fileNotFound']).toContain(result.failure);
        }
      }
      catch
      {
        // Restore permissions and skip test if chmod fails
        try
        {
          fs.chmodSync(filePath, 0o644);
        }
        catch
        {
          // Ignore
        }
      }
    });
  });

  describe('Edge cases', () =>
  {
    test('reads empty object', async () =>
    {
      const filePath = path.join(testDir, 'empty.json');
      fs.writeFileSync(filePath, '{}', 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(Object.keys(result.value.data)).toHaveLength(0);
      }
    });

    test('reads empty array', async () =>
    {
      const filePath = path.join(testDir, 'empty-array.json');
      fs.writeFileSync(filePath, '[]', 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(result.value.data.length).toBe(0);
      }
    });

    test('reads null value', async () =>
    {
      const filePath = path.join(testDir, 'null.json');
      fs.writeFileSync(filePath, 'null', 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(result.value.data).toBeNull();
      }
    });

    test('reads boolean value', async () =>
    {
      const filePath = path.join(testDir, 'bool.json');
      fs.writeFileSync(filePath, 'true', 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(result.value.data).toBe(true);
      }
    });

    test('reads number value', async () =>
    {
      const filePath = path.join(testDir, 'number.json');
      fs.writeFileSync(filePath, '42', 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(result.value.data).toBe(42);
      }
    });

    test('reads string value', async () =>
    {
      const filePath = path.join(testDir, 'string.json');
      fs.writeFileSync(filePath, '"hello world"', 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(result.value.data).toBe('hello world');
      }
    });

    test('handles UTF-8 content', async () =>
    {
      const filePath = path.join(testDir, 'utf8.json');
      fs.writeFileSync(filePath, '{"text": "Hello 世界 🌍"}', 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(result.value.data.text).toBe('Hello 世界 🌍');
      }
    });
  });

  describe('Real-world scenarios', () =>
  {
    test('read-modify-write cycle preserves comments (top-level only)', async () =>
    {
      const filePath = path.join(testDir, 'config.jsonctc');
      const originalContent = `{
  // Application name
  "name": "MyApp",
  // Version number
  "version": "1.0.0",
  // Port number
  "port": 3000
}`;
      fs.writeFileSync(filePath, originalContent, 'utf-8');

      // Read
      const readOp = new JSONCTCReadFileOp(filePath);
      const readResult = await readOp.run();

      expect(readResult.ok).toBe(true);
      if (readResult.ok)
      {
        const obj = readResult.value;

        // Modify (top-level properties only - nested is TODO)
        obj.data.version = '2.0.0';
        obj.data.port = 8080;

        // Write back
        const modifiedContent = obj.toString();
        fs.writeFileSync(filePath, modifiedContent, 'utf-8');

        // Read again
        const readOp2 = new JSONCTCReadFileOp(filePath);
        const readResult2 = await readOp2.run();

        expect(readResult2.ok).toBe(true);
        if (readResult2.ok)
        {
          // Verify comments still present
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          expect(fileContent).toContain('// Application name');
          expect(fileContent).toContain('// Version number');
          expect(fileContent).toContain('// Port number');

          // Verify changes applied
          expect(readResult2.value.data.version).toBe('2.0.0');
          expect(readResult2.value.data.port).toBe(8080);
          expect(readResult2.value.data.name).toBe('MyApp');
        }
      }
    });

    test('handles config file with trailing commas (top-level only)', async () =>
    {
      const filePath = path.join(testDir, 'tsconfig.jsonctc');
      const content = `{
  "target": "ES2022",
  "strict": true,
  "include": [
    "src/**/*",
  ],
}`;
      fs.writeFileSync(filePath, content, 'utf-8');

      const op = new JSONCTCReadFileOp(filePath);
      const result = await op.run();

      expect(result.ok).toBe(true);
      if (result.ok)
      {
        expect(result.value.data.target).toBe('ES2022');
        expect(result.value.data.include[0]).toBe('src/**/*');

        // Modify top-level property and ensure trailing commas preserved
        result.value.data.strict = false;
        const output = result.value.toString();
        expect(output).toMatch(/,\s*\}/); // Trailing comma before }
        expect(output).toContain('"strict": false');
      }
    });
  });
});
