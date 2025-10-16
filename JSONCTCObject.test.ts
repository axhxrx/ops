import { describe, expect, test } from 'bun:test';
import { JSONCTCObject } from './JSONCTCObject';

describe('JSONCTCObject', () =>
{
  describe('Construction', () =>
  {
    test('create from string - parses correctly', () =>
    {
      const jsonStr = '{"name": "Alice", "age": 30}';
      const obj = new JSONCTCObject(jsonStr);

      expect(obj.data.name).toBe('Alice');
      expect(obj.data.age).toBe(30);
    });

    test('create from string with comments', () =>
    {
      const jsonStr = `{
  // User info
  "name": "Alice",
  /* Age in years */
  "age": 30
}`;
      const obj = new JSONCTCObject(jsonStr);

      expect(obj.data.name).toBe('Alice');
      expect(obj.data.age).toBe(30);
    });

    test('create from string with trailing comma', () =>
    {
      const jsonStr = `{
  "name": "Alice",
  "age": 30,
}`;
      const obj = new JSONCTCObject(jsonStr);

      expect(obj.data.name).toBe('Alice');
      expect(obj.data.age).toBe(30);
    });

    test('create from object - works without originalText', () =>
    {
      const data = { name: 'Bob', age: 25 };
      const obj = new JSONCTCObject(data);

      expect(obj.data.name).toBe('Bob');
      expect(obj.data.age).toBe(25);
    });

    test('create from object with originalText', () =>
    {
      const data = { name: 'Bob', age: 25 };
      const originalText = '{"name": "Alice", "age": 30}';
      const obj = new JSONCTCObject(data, originalText);

      expect(obj.data.name).toBe('Bob');
      expect(obj.data.age).toBe(25);
    });
  });

  describe('Property Access via Proxy', () =>
  {
    test('read property via obj.data - returns correct value', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30, active: true });

      expect(obj.data.name).toBe('Alice');
      expect(obj.data.age).toBe(30);
      expect(obj.data.active).toBe(true);
    });

    test('read non-existent property returns undefined', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice' });

      expect(obj.data.nonExistent).toBeUndefined();
    });

    test('set property via obj.data - tracks change', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30 });

      obj.data.name = 'Bob';

      expect(obj.data.name).toBe('Bob');
      expect(obj.data.age).toBe(30); // Unchanged
    });

    test('set new property - tracks addition', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice' });

      obj.data.email = 'alice@example.com';

      expect(obj.data.name).toBe('Alice');
      expect(obj.data.email).toBe('alice@example.com');
    });

    test('set multiple properties', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30 });

      obj.data.name = 'Bob';
      obj.data.age = 25;
      obj.data.city = 'Paris';

      expect(obj.data.name).toBe('Bob');
      expect(obj.data.age).toBe(25);
      expect(obj.data.city).toBe('Paris');
    });
  });

  describe('Property Deletion', () =>
  {
    test('delete property - tracks deletion', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30, city: 'NYC' });

      delete obj.data.city;

      expect(obj.data.name).toBe('Alice');
      expect(obj.data.age).toBe(30);
      expect(obj.data.city).toBeUndefined();
    });

    test('delete property removes from output', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30, city: 'NYC' });

      delete obj.data.city;

      const output = obj.toString();
      const parsed = JSON.parse(output);

      expect(parsed).toEqual({ name: 'Alice', age: 30 });
      expect('city' in parsed).toBe(false);
    });

    test('delete then set restores property', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30 });

      delete obj.data.age;
      expect(obj.data.age).toBeUndefined();

      obj.data.age = 25;
      expect(obj.data.age).toBe(25);
    });

    test('has operator respects deletions', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30 });

      expect('age' in obj.data).toBe(true);

      delete obj.data.age;

      expect('age' in obj.data).toBe(false);
    });
  });

  describe('toString() without originalText', () =>
  {
    test('generates valid JSON', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30 });

      const output = obj.toString();

      expect(() => JSON.parse(output)).not.toThrow();
    });

    test('includes modifications', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30 });
      obj.data.name = 'Bob';
      obj.data.city = 'Paris';

      const output = obj.toString();
      const parsed = JSON.parse(output);

      expect(parsed.name).toBe('Bob');
      expect(parsed.age).toBe(30);
      expect(parsed.city).toBe('Paris');
    });

    test('excludes deleted properties', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30, city: 'NYC' });
      delete obj.data.city;

      const output = obj.toString();
      const parsed = JSON.parse(output);

      expect(parsed).toEqual({ name: 'Alice', age: 30 });
    });

    test('formats with 2-space indentation', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30 });

      const output = obj.toString();

      expect(output).toContain('  "name"');
      expect(output).toContain('  "age"');
    });

    test('includes final newline', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice' });

      const output = obj.toString();

      expect(output.endsWith('\n')).toBe(true);
    });
  });

  describe('toString() with originalText - preserves comments', () =>
  {
    test('preserves line comments', () =>
    {
      const jsonStr = `{
  // User name
  "name": "Alice",
  // User age
  "age": 30
}`;
      const obj = new JSONCTCObject(jsonStr);
      obj.data.name = 'Bob';

      const output = obj.toString();

      expect(output).toContain('// User name');
      expect(output).toContain('// User age');
      expect(output).toContain('Bob');
    });

    test('preserves block comments', () =>
    {
      const jsonStr = `{
  /* This is a block comment
     spanning multiple lines */
  "name": "Alice",
  /* Another comment */ "age": 30
}`;
      const obj = new JSONCTCObject(jsonStr);
      obj.data.age = 25;

      const output = obj.toString();

      expect(output).toContain('/* This is a block comment');
      expect(output).toContain('spanning multiple lines */');
      expect(output).toContain('/* Another comment */');
      expect(output).toContain('25');
    });

    test('preserves trailing commas', () =>
    {
      const jsonStr = `{
  "name": "Alice",
  "age": 30,
}`;
      const obj = new JSONCTCObject(jsonStr);
      obj.data.name = 'Bob';

      const output = obj.toString();

      // Should have trailing comma before closing brace
      expect(output).toMatch(/,\s*}/);
      expect(output).toContain('Bob');
    });

    test('preserves comments when adding new property', () =>
    {
      const jsonStr = `{
  // User name
  "name": "Alice"
}`;
      const obj = new JSONCTCObject(jsonStr);
      obj.data.age = 30;

      const output = obj.toString();

      expect(output).toContain('// User name');
      expect(output).toContain('Alice');
      expect(output).toContain('30');
    });

    test('preserves comments when deleting property', () =>
    {
      const jsonStr = `{
  // User name
  "name": "Alice",
  // User age
  "age": 30,
  // User city
  "city": "NYC"
}`;
      const obj = new JSONCTCObject(jsonStr);
      delete obj.data.city;

      const output = obj.toString();

      expect(output).toContain('// User name');
      expect(output).toContain('// User age');
      // The city comment might still be there depending on jsonc-parser behavior
      expect(output).not.toContain('"city"');
    });

    test('preserves multiple comments at different positions', () =>
    {
      const jsonStr = `{
  // Start comment
  "name": "Alice", // Inline comment
  /* Block comment */
  "age": 30
  // End comment
}`;
      const obj = new JSONCTCObject(jsonStr);
      obj.data.name = 'Bob';
      obj.data.age = 25;

      const output = obj.toString();

      expect(output).toContain('// Start comment');
      expect(output).toContain('// Inline comment');
      expect(output).toContain('/* Block comment */');
      expect(output).toContain('// End comment');
      expect(output).toContain('Bob');
      expect(output).toContain('25');
    });
  });

  describe('Round-trip operations', () =>
  {
    test('string → object → modify → toString preserves comments', () =>
    {
      const original = `{
  // Configuration file
  "name": "Alice",
  "age": 30,
  // Status
  "active": true
}`;

      // Parse
      const obj = new JSONCTCObject(original);

      // Modify
      obj.data.name = 'Bob';
      obj.data.age = 25;

      // Serialize
      const output = obj.toString();

      // Verify comments preserved
      expect(output).toContain('// Configuration file');
      expect(output).toContain('// Status');

      // Verify changes applied
      expect(output).toContain('Bob');
      expect(output).toContain('25');

      // Verify it's still valid JSONCTC
      const reparsed = new JSONCTCObject(output);
      expect(reparsed.data.name).toBe('Bob');
      expect(reparsed.data.age).toBe(25);
      expect(reparsed.data.active).toBe(true);
    });

    test('multiple round-trips preserve comments', () =>
    {
      let text = `{
  // Version
  "version": "1.0",
  // Data
  "data": "initial"
}`;

      // First round-trip
      let obj = new JSONCTCObject(text);
      obj.data.data = 'modified-1';
      text = obj.toString();

      expect(text).toContain('// Version');
      expect(text).toContain('// Data');

      // Second round-trip
      obj = new JSONCTCObject(text);
      obj.data.data = 'modified-2';
      text = obj.toString();

      expect(text).toContain('// Version');
      expect(text).toContain('// Data');
      expect(text).toContain('modified-2');

      // Third round-trip
      obj = new JSONCTCObject(text);
      obj.data.version = '2.0';
      text = obj.toString();

      expect(text).toContain('// Version');
      expect(text).toContain('// Data');
      expect(text).toContain('2.0');
      expect(text).toContain('modified-2');
    });
  });

  describe('Complex scenarios', () =>
  {
    test('handles nested objects (reads correctly)', () =>
    {
      const obj = new JSONCTCObject({
        user: {
          name: 'Alice',
          email: 'alice@example.com',
        },
        count: 42,
      });

      expect(obj.data.user.name).toBe('Alice');
      expect(obj.data.user.email).toBe('alice@example.com');
      expect(obj.data.count).toBe(42);
    });

    test('handles arrays (reads correctly)', () =>
    {
      const obj = new JSONCTCObject({
        tags: ['typescript', 'javascript', 'node'],
        counts: [1, 2, 3],
      });

      expect(obj.data.tags[0]).toBe('typescript');
      expect(obj.data.counts[1]).toBe(2);
      expect(obj.data.tags.length).toBe(3);
    });

    test('handles null and boolean values', () =>
    {
      const obj = new JSONCTCObject({
        nullable: null,
        truthy: true,
        falsy: false,
      });

      expect(obj.data.nullable).toBeNull();
      expect(obj.data.truthy).toBe(true);
      expect(obj.data.falsy).toBe(false);
    });

    test('handles empty object', () =>
    {
      const obj = new JSONCTCObject({});

      expect(Object.keys(obj.data)).toHaveLength(0);

      obj.data.newKey = 'newValue';
      expect(obj.data.newKey).toBe('newValue');
    });

    test('handles special characters in values', () =>
    {
      const obj = new JSONCTCObject({ text: 'Hello "World"!\nNew line' });

      expect(obj.data.text).toBe('Hello "World"!\nNew line');

      const output = obj.toString();
      const parsed = JSON.parse(output);
      expect(parsed.text).toBe('Hello "World"!\nNew line');
    });
  });

  describe('Object.keys and enumeration', () =>
  {
    test('Object.keys includes original and new properties', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30 });
      obj.data.city = 'Paris';

      const keys = Object.keys(obj.data);

      expect(keys).toContain('name');
      expect(keys).toContain('age');
      expect(keys).toContain('city');
    });

    test('Object.keys excludes deleted properties', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30, city: 'NYC' });
      delete obj.data.city;

      const keys = Object.keys(obj.data);

      expect(keys).toContain('name');
      expect(keys).toContain('age');
      expect(keys).not.toContain('city');
    });

    test('for...in loop works correctly', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30 });
      obj.data.city = 'Paris';
      delete obj.data.age;

      const keys: string[] = [];
      for (const key in obj.data)
      {
        keys.push(key);
      }

      expect(keys).toContain('name');
      expect(keys).toContain('city');
      expect(keys).not.toContain('age');
    });
  });
});
