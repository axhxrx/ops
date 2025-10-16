import { applyEdits, type FormattingOptions, modify as originalModify, parse, parseTree, findNodeAtLocation } from 'jsonc-parser';

/**
 * HALL-OF-FAMER RADGUY O.G. WAREZ KINGPIN MONKEYPATCH!
 *
 * The original jsonc-parser's modify() doesn't support array element paths.
 * This wrapper intercepts array index operations and handles them manually.
 *
 * For array elements, we:
 * 1. Parse to find the array
 * 2. Manually locate and replace the element in the text
 * 3. Preserve surrounding comments!
 *
 * For everything else, we delegate to the original modify().
 */
function modify(
  text: string,
  path: (string | number)[],
  value: unknown,
  options?: { formattingOptions?: FormattingOptions; getInsertionIndex?: () => number; isArrayInsertion?: boolean }
): any[]
{
  // Check if path contains array indices (numbers OR numeric strings!)
  const hasArrayIndex = path.some(segment =>
    typeof segment === 'number' ||
    (typeof segment === 'string' && !isNaN(Number(segment)))
  );

  if (!hasArrayIndex)
  {
    // No array indices - use original modify()
    return originalModify(text, path, value, options);
  }

  // MONKEYPATCH MAGIC: Handle array element modification manually!
  // Strategy: Navigate to the array, then manually edit the element

  // Find where the array index is in the path
  let arrayPathIndex = -1;
  for (let i = 0; i < path.length; i++)
  {
    const segment = path[i];
    if (typeof segment === 'number' || (typeof segment === 'string' && !isNaN(Number(segment))))
    {
      arrayPathIndex = i;
      break;
    }
  }

  if (arrayPathIndex === -1)
  {
    // Shouldn't happen, but fallback
    return originalModify(text, path, value, options);
  }

  // Split path: everything before array index, and the array index itself
  const pathToArray = path.slice(0, arrayPathIndex);
  const indexSegment = path[arrayPathIndex];
  const elementIndex = typeof indexSegment === 'number' ? indexSegment : Number(indexSegment);
  const pathAfterIndex = path.slice(arrayPathIndex + 1);

  // If there's more path after the index, we're modifying nested structure inside array element
  // For now, replace the whole element (simpler approach)
  if (pathAfterIndex.length > 0)
  {
    // TODO: Handle nested paths inside array elements
    // For now, fall back to replacing whole array
    return originalModify(text, pathToArray, value, options);
  }

  // ULTIMATE RADGUY WAREZ KINGPIN TEXT SURGERY!
  // Use parseTree to get exact byte positions of array elements

  const tree = parseTree(text);
  const arrayNode = findNodeAtLocation(tree, pathToArray);

  if (!arrayNode || arrayNode.type !== 'array' || !arrayNode.children)
  {
    // Can't find array or not an array
    return [];
  }

  const children = arrayNode.children;

  // Get the element we're modifying
  if (elementIndex >= children.length)
  {
    // Element doesn't exist yet - would need to add it
    // For now, fall back to replacing whole array
    const parsed = parse(text);
    let current: any = parsed;
    for (const segment of pathToArray)
    {
      current = current?.[segment as string];
    }
    if (Array.isArray(current))
    {
      const newArray = [...current];
      while (newArray.length <= elementIndex)
      {
        newArray.push(undefined);
      }
      newArray[elementIndex] = value;
      return originalModify(text, pathToArray, newArray, options);
    }
    return [];
  }

  const elementNode = children[elementIndex];

  if (value === undefined)
  {
    // DELETE: Remove element and its trailing comma/comment
    // Find the range to delete (element + comma + whitespace until next element or closing bracket)
    const start = elementNode.offset;
    let end = elementNode.offset + elementNode.length;

    // Include trailing comma and whitespace
    while (end < text.length && (text[end] === ',' || text[end] === ' ' || text[end] === '\t'))
    {
      end++;
    }
    // Include newline if present
    if (end < text.length && (text[end] === '\n' || text[end] === '\r'))
    {
      end++;
      if (end < text.length && text[end - 1] === '\r' && text[end] === '\n')
      {
        end++;
      }
    }

    return [{ offset: start, length: end - start, content: '' }];
  }

  // UPDATE: Replace just the element value, preserving surrounding text
  const newValue = JSON.stringify(value);

  // Trailing commas are automatically preserved because we only replace
  // the element text itself, not the comma that comes after it!

  return [{
    offset: elementNode.offset,
    length: elementNode.length,
    content: newValue
  }];
}

/**
 * A smart wrapper for JSONCTC data that tracks mutations and preserves comments.
 *
 * This class provides a Proxy-based interface for working with JSONCTC objects while:
 * - Tracking all property changes and deletions (including nested!)
 * - Preserving comments and trailing commas when serializing back to text
 * - Supporting round-trip editing (string → modify → string) without losing formatting
 * - RECURSIVE: Nested objects are automatically wrapped as JSONCTCObjects!
 *
 * @example
 * ```typescript
 * const obj = new JSONCTCObject('{ "name": "Alice", /* comment *\/ "age": 30 }');
 * obj.data.name = "Bob";  // Track change
 * console.log(obj.toString());  // Comments preserved!
 *
 * // NESTED support!
 * obj.data.settings.theme = 'dark';  // Nested changes tracked too!
 * ```
 *
 * HALL-OF-FAMER RADGUY O.G. WAREZ KINGPIN ACHIEVEMENT UNLOCKED:
 * ✅ Comments INSIDE arrays ARE PRESERVED via element-by-element updates!
 *   Example: ["item1", /* comment *\/ "item2"] → comment PRESERVED on update!
 *   Implementation: Custom monkeypatch using parseTree + findNodeAtLocation for surgical text edits!
 */
export class JSONCTCObject
{
  private originalText: string | null;
  private parsedData: unknown;
  private path: string[];                        // Position in tree: [] for root, ['settings'] for nested
  private children = new Map<string, JSONCTCObject>();  // Nested objects as JSONCTCObjects!
  private changes = new Map<string, unknown>();         // ONLY primitives (objects go in children)
  private deletions = new Set<string>();
  private dataProxy: unknown;

  /**
   * Create a JSONCTCObject from a string or plain object
   *
   * @param source - Either a JSONCTC string to parse, or a plain object
   * @param originalText - Optional original text (used when source is an object)
   * @param path - Position in tree (for nested objects)
   */
  constructor(source: string | object, originalText?: string | null, path: string[] = [])
  {
    this.path = path;

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

    // Pre-wrap all nested objects/arrays as children!
    this.wrapChildren();

    // Create the proxy once during construction
    this.dataProxy = this.createProxy();
  }

  /**
   * Pre-wrap all nested objects and arrays as JSONCTCObject children
   */
  private wrapChildren(): void
  {
    if (typeof this.parsedData !== 'object' || this.parsedData === null)
    {
      return;
    }

    // Iterate over all properties
    for (const [key, value] of Object.entries(this.parsedData))
    {
      // Wrap objects and arrays as children
      if (typeof value === 'object' && value !== null)
      {
        this.children.set(key, new JSONCTCObject(
          value,
          this.originalText,  // Share the same root text!
          [...this.path, key]  // Extend the path
        ));
      }
    }
  }

  /**
   * Get a Proxy that tracks changes to the data
   *
   * RECURSIVE: Nested objects return their own proxies, enabling deep tracking!
   * Example: obj.data.settings.theme will track changes at path ['settings', 'theme']
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
          return Reflect.get(target, prop);
        }

        // RECURSIVE: If we have a child JSONCTCObject, return its proxy!
        if (this.children.has(prop))
        {
          return this.children.get(prop)!.data;
        }

        // Check if we have a tracked primitive change
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

        // Check if we're REPLACING an existing child
        const hasExistingChild = this.children.has(prop);
        const existingChild = hasExistingChild ? this.children.get(prop)! : null;

        // HALL-OF-FAMER RADGUY O.G. WAREZ KINGPIN ENHANCEMENT REQUEST:
        // ARRAY ELEMENT-BY-ELEMENT DIFFING TO PRESERVE COMMENTS!
        if (Array.isArray(value) && existingChild && Array.isArray(existingChild.parsedData))
        {
          // Both old and new are arrays - do element-by-element tracking!
          const oldArray = existingChild.parsedData as unknown[];
          const newArray = value as unknown[];

          // Update each element individually (preserves comments at positions!)
          const maxLen = Math.max(oldArray.length, newArray.length);
          for (let i = 0; i < maxLen; i++)
          {
            if (i < newArray.length)
            {
              // Element exists in new array - set it (will track change if different)
              (existingChild.data as any)[String(i)] = newArray[i];
            }
            else
            {
              // Element doesn't exist in new array - delete it
              delete (existingChild.data as any)[String(i)];
            }
          }

          // Keep the child (don't replace it!)
          // This ensures comments are preserved
          return true;
        }

        // For non-arrays or new properties, use previous behavior
        if (typeof value === 'object' && value !== null)
        {
          if (hasExistingChild)
          {
            // REPLACING an existing child (non-array case)
            this.changes.set(prop, value);
            this.children.delete(prop);
          }
          else
          {
            // NEW object/array - Track as a change
            this.changes.set(prop, value);
          }
        }
        else
        {
          // Primitive value - track in changes
          this.changes.set(prop, value);
          // Remove child if it existed
          this.children.delete(prop);
        }

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

        // Remove child if it existed
        this.children.delete(prop);

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

        // Present if it's a child, changed, or originally present
        return this.children.has(prop) || this.changes.has(prop) || prop in target;
      },

      ownKeys: (target) =>
      {
        const keys = new Set(Reflect.ownKeys(target) as string[]);

        // Add keys from children
        for (const key of this.children.keys())
        {
          keys.add(key);
        }

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

        // Check children first (for nested objects)
        if (this.children.has(prop))
        {
          return {
            value: this.children.get(prop)!.data,
            writable: true,
            enumerable: true,
            configurable: true,
          };
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
      // If no changes, children, or deletions, return original
      if (this.changes.size === 0 && this.deletions.size === 0 && this.children.size === 0)
      {
        return this.parsedData;
      }

      // Create copy and apply changes
      const result = [...this.parsedData];

      // Apply children (recursively get their data)
      for (const [key, child] of this.children)
      {
        const index = Number(key);
        if (!isNaN(index))
        {
          result[index] = child.getCurrentData();
        }
      }

      // Apply primitive changes
      for (const [key, value] of this.changes)
      {
        const index = Number(key);
        if (!isNaN(index))
        {
          result[index] = value;
        }
      }

      // Apply deletions
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

    // Apply children (recursively get their data)
    for (const [key, child] of this.children)
    {
      result[key] = child.getCurrentData();
    }

    // Apply primitive changes
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
   * Recursively collect ALL changes from the entire tree
   *
   * This walks the tree and collects changes at all paths, enabling nested comment preservation!
   *
   * @returns Object with changes (Map<path[], value>) and deletions (Set<path[]>)
   */
  private collectAllChanges(): { changes: Array<[string[], unknown]>; deletions: Array<string[]> }
  {
    const allChanges: Array<[string[], unknown]> = [];
    const allDeletions: Array<string[]> = [];

    // Add our own primitive changes (with path prefix)
    for (const [key, value] of this.changes)
    {
      allChanges.push([[...this.path, key], value]);
    }

    // Add our own deletions (with path prefix)
    for (const key of this.deletions)
    {
      allDeletions.push([...this.path, key]);
    }

    // RECURSIVELY collect from children!
    for (const child of this.children.values())
    {
      const childResults = child.collectAllChanges();

      // Merge child changes
      for (const [path, value] of childResults.changes)
      {
        allChanges.push([path, value]);
      }

      // Merge child deletions
      for (const path of childResults.deletions)
      {
        allDeletions.push(path);
      }
    }

    return { changes: allChanges, deletions: allDeletions };
  }

  /**
   * Serialize the object back to a string
   *
   * If originalText exists, applies changes surgically to preserve comments.
   * Otherwise, generates new JSON with standard formatting.
   *
   * RECURSIVE: Collects changes from entire tree and applies them at full paths!
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

    // Only the ROOT should serialize (path === [])
    if (this.path.length > 0)
    {
      throw new Error('toString() should only be called on root JSONCTCObject');
    }

    try
    {
      // RECURSIVE: Collect ALL changes from entire tree!
      const { changes, deletions } = this.collectAllChanges();

      let modifiedText = this.originalText;

      // First apply all deletions (set to undefined)
      for (const path of deletions)
      {
        const edits = modify(modifiedText, path, undefined, { formattingOptions });
        modifiedText = applyEdits(modifiedText, edits);
      }

      // Then apply all changes (at their FULL paths!)
      for (const [path, value] of changes)
      {
        const edits = modify(modifiedText, path, value, { formattingOptions });
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
