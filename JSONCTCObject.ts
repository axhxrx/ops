import { applyEdits, type FormattingOptions, modify, parse } from 'jsonc-parser';

/**
 * A smart wrapper for JSONCTC data that tracks mutations and preserves comments.
 *
 * This class provides a Proxy-based interface for working with JSONCTC objects while:
 * - Tracking all property changes and deletions
 * - Preserving comments and trailing commas when serializing back to text
 * - Supporting round-trip editing (string → modify → string) without losing formatting
 *
 * @example
 * ```typescript
 * const obj = new JSONCTCObject('{ "name": "Alice", /* comment *\/ "age": 30 }');
 * obj.data.name = "Bob";  // Track change
 * console.log(obj.toString());  // Comments preserved!
 * ```
 */
export class JSONCTCObject
{
  private originalText: string | null;
  private parsedData: unknown;
  private changes = new Map<string, unknown>();
  private deletions = new Set<string>();
  private dataProxy: unknown;

  /**
   * Create a JSONCTCObject from a string or plain object
   *
   * @param source - Either a JSONCTC string to parse, or a plain object
   * @param originalText - Optional original text (used when source is an object)
   */
  constructor(source: string | object, originalText?: string)
  {
    if (typeof source === 'string')
    {
      // Parse the string and store as originalText
      this.originalText = source;
      this.parsedData = parse(source);
    }
    else
    {
      // Store the object directly
      this.parsedData = source;
      this.originalText = originalText ?? null;
    }

    // Create the proxy once during construction
    this.dataProxy = this.createProxy();
  }

  /**
   * Get a Proxy that tracks changes to the data
   *
   * TODO: Currently only supports top-level properties.
   * Future enhancement: Support nested paths like obj.data.settings.theme
   */
  // deno-lint-ignore no-explicit-any
  get data(): any
  {
    return this.dataProxy;
  }

  /**
   * Create a Proxy that intercepts property operations
   */
  private createProxy(): unknown
  {
    if (typeof this.parsedData !== 'object' || this.parsedData === null)
    {
      return this.parsedData;
    }

    return new Proxy(this.parsedData as Record<string, unknown>, {
      get: (target, prop) =>
      {
        if (typeof prop !== 'string')
        {
          return target[prop];
        }

        // Check if we have a tracked change
        if (this.changes.has(prop))
        {
          return this.changes.get(prop);
        }

        // Check if it was deleted
        if (this.deletions.has(prop))
        {
          return undefined;
        }

        // Return original value
        return target[prop];
      },

      set: (_target, prop, value) =>
      {
        if (typeof prop !== 'string')
        {
          return false;
        }

        // Track the change
        this.changes.set(prop, value);

        // Remove from deletions if it was marked for deletion
        this.deletions.delete(prop);

        return true;
      },

      deleteProperty: (_target, prop) =>
      {
        if (typeof prop !== 'string')
        {
          return false;
        }

        // Track the deletion
        this.deletions.add(prop);

        // Remove from changes if it was modified
        this.changes.delete(prop);

        return true;
      },

      has: (target, prop) =>
      {
        if (typeof prop !== 'string')
        {
          return prop in target;
        }

        // Not present if deleted
        if (this.deletions.has(prop))
        {
          return false;
        }

        // Present if changed or originally present
        return this.changes.has(prop) || prop in target;
      },

      ownKeys: (target) =>
      {
        const keys = new Set(Reflect.ownKeys(target) as string[]);

        // Add keys from changes
        for (const key of this.changes.keys())
        {
          keys.add(key);
        }

        // Remove deleted keys
        for (const key of this.deletions)
        {
          keys.delete(key);
        }

        return Array.from(keys);
      },

      getOwnPropertyDescriptor: (target, prop) =>
      {
        if (typeof prop !== 'string')
        {
          return Reflect.getOwnPropertyDescriptor(target, prop);
        }

        if (this.deletions.has(prop))
        {
          return undefined;
        }

        if (this.changes.has(prop))
        {
          return {
            value: this.changes.get(prop),
            writable: true,
            enumerable: true,
            configurable: true,
          };
        }

        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
    });
  }

  /**
   * Get the current state of the data with all changes applied
   */
  private getCurrentData(): unknown
  {
    if (typeof this.parsedData !== 'object' || this.parsedData === null)
    {
      return this.parsedData;
    }

    // Handle arrays separately to avoid {...array} converting to object
    if (Array.isArray(this.parsedData))
    {
      // If no changes, return original array
      if (this.changes.size === 0 && this.deletions.size === 0)
      {
        return this.parsedData;
      }

      // Create copy and apply changes
      const result = [...this.parsedData];

      for (const [key, value] of this.changes)
      {
        const index = Number(key);
        if (!isNaN(index))
        {
          result[index] = value;
        }
      }

      for (const key of this.deletions)
      {
        const index = Number(key);
        if (!isNaN(index))
        {
          delete result[index];
        }
      }

      return result;
    }

    // Handle objects
    const result = { ...(this.parsedData as Record<string, unknown>) };

    // Apply changes
    for (const [key, value] of this.changes)
    {
      result[key] = value;
    }

    // Apply deletions
    for (const key of this.deletions)
    {
      delete result[key];
    }

    return result;
  }

  /**
   * Serialize the object back to a string
   *
   * If originalText exists, applies changes surgically to preserve comments.
   * Otherwise, generates new JSON with standard formatting.
   */
  toString(): string
  {
    const formattingOptions: FormattingOptions = {
      tabSize: 2,
      insertSpaces: true,
      insertFinalNewline: true,
      eol: '\n',
    };

    // If no original text, just stringify
    if (!this.originalText)
    {
      return JSON.stringify(this.getCurrentData(), null, 2) + '\n';
    }

    try
    {
      // Apply changes surgically to preserve comments
      let modifiedText = this.originalText;

      // First apply all deletions (set to undefined)
      for (const key of this.deletions)
      {
        const edits = modify(modifiedText, [key], undefined, { formattingOptions });
        modifiedText = applyEdits(modifiedText, edits);
      }

      // Then apply all changes
      for (const [key, value] of this.changes)
      {
        const edits = modify(modifiedText, [key], value, { formattingOptions });
        modifiedText = applyEdits(modifiedText, edits);
      }

      return modifiedText;
    }
    catch (error: unknown)
    {
      // If modification fails, fall back to stringify
      console.warn('Failed to apply edits surgically, falling back to JSON.stringify:', error);
      return JSON.stringify(this.getCurrentData(), null, 2) + '\n';
    }
  }
}
