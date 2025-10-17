import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getConfigNamespace, resetConfigContext, setConfigNamespace } from './ConfigContext';
import { ReadConfigOp } from './ReadConfigOp';
import { WriteConfigOp } from './WriteConfigOp';

describe('ConfigContext', () =>
{
  afterEach(() =>
  {
    resetConfigContext();
  });

  test('default namespace is com.axhxrx.ops', () =>
  {
    expect(getConfigNamespace()).toBe('com.axhxrx.ops');
  });

  test('can set and get namespace', () =>
  {
    setConfigNamespace('my-test-app');
    expect(getConfigNamespace()).toBe('my-test-app');
  });

  test('sanitizes namespace', () =>
  {
    setConfigNamespace('my app/with\\bad:chars');
    expect(getConfigNamespace()).toBe('my-app-with-bad-chars');
  });

  test('allows dots in namespace', () =>
  {
    setConfigNamespace('com.example.myapp');
    expect(getConfigNamespace()).toBe('com.example.myapp');
  });

  test('resetConfigContext restores defaults', () =>
  {
    setConfigNamespace('custom');
    resetConfigContext();
    expect(getConfigNamespace()).toBe('com.axhxrx.ops');
  });
});

describe('WriteConfigOp and ReadConfigOp', () =>
{
  const testNamespace = 'test-config-ops';
  const homeConfigDir = path.join(os.homedir(), '.config', testNamespace);

  beforeEach(() =>
  {
    resetConfigContext();
    setConfigNamespace(testNamespace);
  });

  afterEach(() =>
  {
    // Clean up test files
    try
    {
      if (fs.existsSync(homeConfigDir))
      {
        fs.rmSync(homeConfigDir, { recursive: true });
      }
    }
    catch
    {
      // Ignore cleanup errors
    }
    resetConfigContext();
  });

  test('write and read string value', async () =>
  {
    const writeOp = new WriteConfigOp('test-key', 'test-value');
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);
    if (writeResult.ok)
    {
      expect(writeResult.value).toContain('.config');
      expect(writeResult.value).toContain(testNamespace);
      expect(writeResult.value).toContain('test-key.jsonctc');
    }

    const readOp = new ReadConfigOp<string>('test-key');
    const readResult = await readOp.run();

    expect(readResult.ok).toBe(true);
    if (readResult.ok)
    {
      expect(readResult.value).toBe('test-value');
    }
  });

  test('write and read object value', async () =>
  {
    const testObj = { foo: 'bar', count: 42, nested: { key: 'value' } };
    const writeOp = new WriteConfigOp('test-obj', testObj);
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);

    const readOp = new ReadConfigOp<typeof testObj>('test-obj');
    const readResult = await readOp.run();

    expect(readResult.ok).toBe(true);
    if (readResult.ok)
    {
      expect(readResult.value).toEqual(testObj);
    }
  });

  test('write and read array value', async () =>
  {
    const testArray = ['url1', 'url2', 'url3'];
    const writeOp = new WriteConfigOp('recent-urls', testArray);
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);

    const readOp = new ReadConfigOp<string[]>('recent-urls');
    const readResult = await readOp.run();

    expect(readResult.ok).toBe(true);
    if (readResult.ok)
    {
      expect(readResult.value).toEqual(testArray);
    }
  });

  test('read returns default value if not found', async () =>
  {
    const readOp = new ReadConfigOp<string>('nonexistent-key', {
      defaultValue: 'default-value',
    });
    const result = await readOp.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      expect(result.value).toBe('default-value');
    }
  });

  test('read fails with notFound if no default', async () =>
  {
    const readOp = new ReadConfigOp<string>('nonexistent-key');
    const result = await readOp.run();

    expect(result.ok).toBe(false);
    if (!result.ok)
    {
      expect(result.failure).toBe('notFound');
    }
  });

  test('overwrite existing value', async () =>
  {
    const writeOp1 = new WriteConfigOp('test-key', 'value1');
    await writeOp1.run();

    const writeOp2 = new WriteConfigOp('test-key', 'value2');
    const result2 = await writeOp2.run();

    expect(result2.ok).toBe(true);

    const readOp = new ReadConfigOp<string>('test-key');
    const readResult = await readOp.run();

    expect(readResult.ok).toBe(true);
    if (readResult.ok)
    {
      expect(readResult.value).toBe('value2');
    }
  });

  test('namespace override works', async () =>
  {
    const customNamespace = 'test-custom-namespace';
    const writeOp = new WriteConfigOp('test-key', 'namespaced-value', {
      namespace: customNamespace,
    });
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);
    if (writeResult.ok)
    {
      expect(writeResult.value).toContain(customNamespace);
    }

    const readOp = new ReadConfigOp<string>('test-key', {
      namespace: customNamespace,
    });
    const readResult = await readOp.run();

    expect(readResult.ok).toBe(true);
    if (readResult.ok)
    {
      expect(readResult.value).toBe('namespaced-value');
    }

    // Clean up custom namespace
    try
    {
      const customDir = path.join(os.homedir(), '.config', customNamespace);
      if (fs.existsSync(customDir))
      {
        fs.rmSync(customDir, { recursive: true });
      }
    }
    catch
    {
      // Ignore
    }
  });

  test('sanitizes key names', async () =>
  {
    const writeOp = new WriteConfigOp('key/with\\bad:chars', 'value');
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);
    if (writeResult.ok)
    {
      expect(writeResult.value).toContain('key-with-bad-chars.jsonctc');
    }

    const readOp = new ReadConfigOp<string>('key/with\\bad:chars');
    const readResult = await readOp.run();

    expect(readResult.ok).toBe(true);
    if (readResult.ok)
    {
      expect(readResult.value).toBe('value');
    }
  });

  test('pretty option creates formatted JSON', async () =>
  {
    const testObj = { foo: 'bar', count: 42 };
    const writeOp = new WriteConfigOp('test-pretty', testObj, {
      pretty: true,
    });
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);
    if (writeResult.ok)
    {
      const content = fs.readFileSync(writeResult.value, 'utf-8');
      // Pretty JSON should have newlines and indentation
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    }
  });

  test('non-pretty option creates compact JSON', async () =>
  {
    const testObj = { foo: 'bar', count: 42 };
    const writeOp = new WriteConfigOp('test-compact', testObj, {
      pretty: false,
    });
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);
    if (writeResult.ok)
    {
      const content = fs.readFileSync(writeResult.value, 'utf-8');
      // Compact JSON should be single line
      expect(content).not.toContain('\n');
    }
  });
});

describe('JSONCTC Comment Preservation', () =>
{
  const testNamespace = 'test-jsonctc-comments';
  const homeConfigDir = path.join(os.homedir(), '.config', testNamespace);

  beforeEach(() =>
  {
    resetConfigContext();
    setConfigNamespace(testNamespace);
  });

  afterEach(() =>
  {
    // Clean up test files
    try
    {
      if (fs.existsSync(homeConfigDir))
      {
        fs.rmSync(homeConfigDir, { recursive: true });
      }
    }
    catch
    {
      // Ignore cleanup errors
    }
    resetConfigContext();
  });

  test('preserves line comments', async () =>
  {
    // Create a config file with line comments
    const configPath = path.join(homeConfigDir, 'test-line-comments.jsonctc');
    fs.mkdirSync(homeConfigDir, { recursive: true });

    const contentWithComments = `{
  // This is a line comment at the start
  "name": "original-value",
  // This is a line comment in the middle
  "count": 42
  // This is a line comment at the end
}`;

    fs.writeFileSync(configPath, contentWithComments, 'utf-8');

    // Update the value using WriteConfigOp
    const writeOp = new WriteConfigOp('test-line-comments', {
      name: 'updated-value',
      count: 42,
    });
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);

    // Read the file back and verify comments are still there
    const updatedContent = fs.readFileSync(configPath, 'utf-8');
    expect(updatedContent).toContain('// This is a line comment at the start');
    expect(updatedContent).toContain('// This is a line comment in the middle');
    expect(updatedContent).toContain('// This is a line comment at the end');
    expect(updatedContent).toContain('updated-value');
  });

  test('preserves block comments', async () =>
  {
    // Create a config file with block comments
    const configPath = path.join(homeConfigDir, 'test-block-comments.jsonctc');
    fs.mkdirSync(homeConfigDir, { recursive: true });

    const contentWithComments = `{
  /* This is a block comment
     that spans multiple lines */
  "data": "original",
  /* Another block comment */ "status": "active"
}`;

    fs.writeFileSync(configPath, contentWithComments, 'utf-8');

    // Update the value
    const writeOp = new WriteConfigOp('test-block-comments', {
      data: 'modified',
      status: 'active',
    });
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);

    // Verify block comments preserved
    const updatedContent = fs.readFileSync(configPath, 'utf-8');
    expect(updatedContent).toContain('/* This is a block comment');
    expect(updatedContent).toContain('that spans multiple lines */');
    expect(updatedContent).toContain('/* Another block comment */');
    expect(updatedContent).toContain('modified');
  });

  test('preserves trailing commas in objects', async () =>
  {
    // Create a config file with trailing comma in object
    const configPath = path.join(homeConfigDir, 'test-trailing-object.jsonctc');
    fs.mkdirSync(homeConfigDir, { recursive: true });

    const contentWithTrailingComma = `{
  "key": "value",
  "number": 123,
}`;

    fs.writeFileSync(configPath, contentWithTrailingComma, 'utf-8');

    // Update the value
    const writeOp = new WriteConfigOp('test-trailing-object', {
      key: 'new-value',
      number: 456,
    });
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);

    // Verify trailing comma preserved
    const updatedContent = fs.readFileSync(configPath, 'utf-8');
    // Look for trailing comma before closing brace
    expect(updatedContent).toMatch(/,\s*}/);
    expect(updatedContent).toContain('new-value');
    expect(updatedContent).toContain('456');
  });

  test('preserves trailing commas in arrays', async () =>
  {
    // Create a config file with trailing comma in array
    const configPath = path.join(homeConfigDir, 'test-trailing-array.jsonctc');
    fs.mkdirSync(homeConfigDir, { recursive: true });

    const contentWithTrailingComma = `[
  "item1",
  "item2",
  "item3",
]`;

    fs.writeFileSync(configPath, contentWithTrailingComma, 'utf-8');

    // Update the array
    const writeOp = new WriteConfigOp('test-trailing-array', [
      'new-item1',
      'new-item2',
      'new-item3',
    ]);
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);

    // Verify trailing comma preserved
    const updatedContent = fs.readFileSync(configPath, 'utf-8');
    // Look for trailing comma before closing bracket
    expect(updatedContent).toMatch(/,\s*]/);
    expect(updatedContent).toContain('new-item1');
    expect(updatedContent).toContain('new-item2');
  });

  test('preserves multiple comments at different positions', async () =>
  {
    // Create a config file with comments in various positions
    const configPath = path.join(homeConfigDir, 'test-multi-comments.jsonctc');
    fs.mkdirSync(homeConfigDir, { recursive: true });

    const contentWithComments = `{
  // Comment before first property
  "username": "alice",
  "email": "alice@example.com", // Inline comment
  /* Block comment before nested object */
  "settings": {
    // Nested comment
    "theme": "dark",
    "notifications": true // Another inline
  },
  // Comment before array
  "tags": [
    "user", // Comment in array
    "admin"
  ]
  // Final comment
}`;

    fs.writeFileSync(configPath, contentWithComments, 'utf-8');

    // Update values
    const writeOp = new WriteConfigOp('test-multi-comments', {
      username: 'bob',
      email: 'bob@example.com',
      settings: {
        theme: 'light',
        notifications: false,
      },
      tags: ['user', 'moderator'],
    });
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);

    // Verify ALL comments preserved
    const updatedContent = fs.readFileSync(configPath, 'utf-8');
    expect(updatedContent).toContain('// Comment before first property');
    expect(updatedContent).toContain('// Inline comment');
    expect(updatedContent).toContain('/* Block comment before nested object */');
    expect(updatedContent).toContain('// Nested comment');
    expect(updatedContent).toContain('// Another inline');
    expect(updatedContent).toContain('// Comment before array');
    expect(updatedContent).toContain('// Comment in array');
    expect(updatedContent).toContain('// Final comment');

    // Verify values updated
    expect(updatedContent).toContain('bob');
    expect(updatedContent).toContain('light');
    expect(updatedContent).toContain('moderator');
  });

  test('handles new files without comments correctly', async () =>
  {
    // Write to a non-existent file
    const writeOp = new WriteConfigOp('test-new-file', {
      fresh: 'data',
      created: 'now',
    });
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);

    // Verify file was created with valid JSON
    if (writeResult.ok)
    {
      const content = fs.readFileSync(writeResult.value, 'utf-8');

      // Should be valid JSON that can be parsed
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      expect(() => JSON.parse(content)).not.toThrow();

      // Should contain our data
      expect(content).toContain('fresh');
      expect(content).toContain('data');

      // Read it back to verify it works
      const readOp = new ReadConfigOp<{ fresh: string; created: string }>('test-new-file');
      const readResult = await readOp.run();

      expect(readResult.ok).toBe(true);
      if (readResult.ok)
      {
        expect(readResult.value.fresh).toBe('data');
        expect(readResult.value.created).toBe('now');
      }
    }
  });

  test('round-trip with comments', async () =>
  {
    // Step 1: Write initial file with comments
    const configPath = path.join(homeConfigDir, 'test-roundtrip.jsonctc');
    fs.mkdirSync(homeConfigDir, { recursive: true });

    const initialContent = `{
  // Version tracking
  "version": "1.0.0",
  // User preferences
  "preference": "original",
  // Last updated timestamp
  "timestamp": 1234567890
}`;

    fs.writeFileSync(configPath, initialContent, 'utf-8');

    // Step 2: Read the value
    const readOp1 = new ReadConfigOp<{ version: string; preference: string; timestamp: number }>('test-roundtrip');
    const readResult1 = await readOp1.run();

    expect(readResult1.ok).toBe(true);
    if (readResult1.ok)
    {
      expect(readResult1.value.preference).toBe('original');
    }

    // Step 3: Write different value
    const writeOp = new WriteConfigOp('test-roundtrip', {
      version: '2.0.0',
      preference: 'updated',
      timestamp: 9876543210,
    });
    const writeResult = await writeOp.run();

    expect(writeResult.ok).toBe(true);

    // Step 4: Verify comments still preserved
    const finalContent = fs.readFileSync(configPath, 'utf-8');
    expect(finalContent).toContain('// Version tracking');
    expect(finalContent).toContain('// User preferences');
    expect(finalContent).toContain('// Last updated timestamp');

    // Step 5: Verify values updated
    expect(finalContent).toContain('2.0.0');
    expect(finalContent).toContain('updated');
    expect(finalContent).toContain('9876543210');

    // Step 6: Read back to confirm data integrity
    const readOp2 = new ReadConfigOp<{ version: string; preference: string; timestamp: number }>('test-roundtrip');
    const readResult2 = await readOp2.run();

    expect(readResult2.ok).toBe(true);
    if (readResult2.ok)
    {
      expect(readResult2.value.version).toBe('2.0.0');
      expect(readResult2.value.preference).toBe('updated');
      expect(readResult2.value.timestamp).toBe(9876543210);
    }
  });
});
