/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { describe, expect, test } from 'bun:test';
import { JSONCTCObject } from './JSONCTCObject.ts';

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

  describe('extract() - Type-safe data extraction', () =>
  {
    test('extract existing value at simple path', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30 });
      const result = obj.extract('name', 'default');

      expect(result).toBe('Alice');
    });

    test('extract existing value at nested path (dot notation)', () =>
    {
      const obj = new JSONCTCObject({
        user: { name: 'Alice', profile: { city: 'NYC' } },
      });
      const result = obj.extract('user.profile.city', 'default');

      expect(result).toBe('NYC');
    });

    test('extract existing value at nested path (array notation)', () =>
    {
      const obj = new JSONCTCObject({
        user: { name: 'Alice', profile: { city: 'NYC' } },
      });
      const result = obj.extract(['user', 'profile', 'city'], 'default');

      expect(result).toBe('NYC');
    });

    test('extract missing path returns default', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice' });
      const result = obj.extract('email', 'noemail@example.com');

      expect(result).toBe('noemail@example.com');
    });

    test('extract from non-existent nested path returns default', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice' });
      const result = obj.extract('user.profile.city', 'NYC');

      expect(result).toBe('NYC');
    });

    test('extract with type mismatch returns default', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', count: 42 });
      // Expecting string but count is number
      const result = obj.extract('count', 'default');

      expect(result).toBe('default');
    });

    test('extract object - deep merges with default', () =>
    {
      const obj = new JSONCTCObject({
        config: {
          theme: 'dark',
          fontSize: 14,
        },
      });

      const defaultConfig = {
        theme: 'light',
        fontSize: 12,
        fontFamily: 'Arial',
      };

      const result = obj.extract('config', defaultConfig);

      // Properties from file override default
      expect(result.theme).toBe('dark');
      expect(result.fontSize).toBe(14);
      // Missing property comes from default
      expect(result.fontFamily).toBe('Arial');
    });

    test('extract nested object - deep merges recursively', () =>
    {
      const obj = new JSONCTCObject({
        app: {
          ui: {
            theme: 'dark',
          },
          network: {
            timeout: 5000,
          },
        },
      });

      const defaultConfig = {
        ui: {
          theme: 'light',
          fontSize: 12,
        },
        network: {
          timeout: 3000,
          retries: 3,
        },
      };

      const result = obj.extract('app', defaultConfig);

      // Deep merged!
      expect(result.ui.theme).toBe('dark');
      expect(result.ui.fontSize).toBe(12); // From default
      expect(result.network.timeout).toBe(5000);
      expect(result.network.retries).toBe(3); // From default
    });

    test('extract array returns array (no merge)', () =>
    {
      const obj = new JSONCTCObject({
        tags: ['typescript', 'javascript'],
      });

      const result = obj.extract('tags', ['default']);

      expect(result).toEqual(['typescript', 'javascript']);
      expect(result).not.toEqual(['default']);
    });

    test('extract primitive from nested path', () =>
    {
      const obj = new JSONCTCObject({
        settings: {
          volume: 75,
        },
      });

      const result = obj.extract('settings.volume', 50);

      expect(result).toBe(75);
    });

    test('extract preserves type inference', () =>
    {
      interface Config
      {
        host: string;
        port: number;
      }

      const obj = new JSONCTCObject({
        server: { host: 'localhost', port: 8080 },
      });

      const defaultConfig: Config = { host: '0.0.0.0', port: 3000 };
      const result = obj.extract('server', defaultConfig);

      // TypeScript should infer result as Config
      const host: string = result.host;
      const port: number = result.port;

      expect(host).toBe('localhost');
      expect(port).toBe(8080);
    });
  });

  describe('update() - Type-safe data updates', () =>
  {
    test('update existing property at simple path', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice', age: 30 });
      obj.update('name', 'Bob');

      expect(obj.data.name).toBe('Bob');
      expect(obj.data.age).toBe(30);
    });

    test('update existing property at nested path (dot notation)', () =>
    {
      const obj = new JSONCTCObject({
        user: { name: 'Alice', profile: { city: 'NYC' } },
      });

      obj.update('user.profile.city', 'SF');

      expect(obj.data.user.profile.city).toBe('SF');
      expect(obj.data.user.name).toBe('Alice');
    });

    test('update existing property at nested path (array notation)', () =>
    {
      const obj = new JSONCTCObject({
        user: { name: 'Alice', profile: { city: 'NYC' } },
      });

      obj.update(['user', 'profile', 'city'], 'LA');

      expect(obj.data.user.profile.city).toBe('LA');
    });

    test('update creates intermediate objects', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice' });
      obj.update('user.profile.city', 'NYC');

      expect(obj.data.user.profile.city).toBe('NYC');
      expect(obj.data.name).toBe('Alice');
    });

    test('update deeply nested path creates all intermediate objects', () =>
    {
      const obj = new JSONCTCObject({});
      obj.update('a.b.c.d.e', 'deep');

      expect(obj.data.a.b.c.d.e).toBe('deep');
    });

    test('update with number value', () =>
    {
      const obj = new JSONCTCObject({ count: 0 });
      obj.update('count', 42);

      expect(obj.data.count).toBe(42);
    });

    test('update with boolean value', () =>
    {
      const obj = new JSONCTCObject({ active: false });
      obj.update('active', true);

      expect(obj.data.active).toBe(true);
    });

    test('update with object value', () =>
    {
      const obj = new JSONCTCObject({ user: { name: 'Alice' } });
      obj.update('user', { name: 'Bob', age: 30 });

      expect(obj.data.user.name).toBe('Bob');
      expect(obj.data.user.age).toBe(30);
    });

    test('update with array value', () =>
    {
      const obj = new JSONCTCObject({ tags: ['old'] });
      obj.update('tags', ['new', 'tags']);

      expect(obj.data.tags).toEqual(['new', 'tags']);
    });

    test('update preserves comments in toString()', () =>
    {
      const jsonStr = `{
  // User name
  "name": "Alice",
  // User age
  "age": 30
}`;
      const obj = new JSONCTCObject(jsonStr);

      obj.update('name', 'Bob');

      const output = obj.toString();

      expect(output).toContain('// User name');
      expect(output).toContain('// User age');
      expect(output).toContain('Bob');
    });

    test('update nested path preserves comments', () =>
    {
      const jsonStr = `{
  // Configuration
  "config": {
    // Theme setting
    "theme": "light"
  }
}`;
      const obj = new JSONCTCObject(jsonStr);

      obj.update('config.theme', 'dark');

      const output = obj.toString();

      expect(output).toContain('// Configuration');
      expect(output).toContain('// Theme setting');
      expect(output).toContain('dark');
    });

    test('update multiple paths independently', () =>
    {
      const obj = new JSONCTCObject({
        a: { value: 1 },
        b: { value: 2 },
      });

      obj.update('a.value', 10);
      obj.update('b.value', 20);

      expect(obj.data.a.value).toBe(10);
      expect(obj.data.b.value).toBe(20);
    });

    test('update throws on empty path', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice' });

      expect(() => obj.update([], 'value')).toThrow('Cannot update root');
      expect(() => obj.update('', 'value')).toThrow('Cannot update root');
    });

    test('update throws when parent is not an object', () =>
    {
      const obj = new JSONCTCObject({ name: 'Alice' });

      // Trying to set a property on a string value
      expect(() => obj.update('name.nested', 'value')).toThrow('parent is not an object');
    });

    test('update works with extract for round-trip', () =>
    {
      interface Config
      {
        timeout: number;
        retries: number;
      }

      const obj = new JSONCTCObject({
        server: { timeout: 3000, retries: 3 },
      });

      const defaultConfig: Config = { timeout: 5000, retries: 5 };
      const config = obj.extract('server', defaultConfig);

      // Modify extracted value
      config.timeout = 10000;

      // Update back
      obj.update('server', config);

      // Verify
      expect(obj.data.server.timeout).toBe(10000);
      expect(obj.data.server.retries).toBe(3);
    });
  });
});
