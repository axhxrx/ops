/**
 * UI Primitives for building rich, type-safe menus
 *
 * These primitives separate data/content from rendering, making it easy to construct
 * complex menus with auto-layout, keyboard shortcuts, and reactive content.
 *
 * @example
 * ```typescript
 * const menu = Menu.create(
 *   MenuItem.create('new').label('[N]ew file').help('Create a new file'),
 *   MenuItem.create('open').label('[O]pen').help('Open existing file')
 * )
 * .header(InfoPanel.text('My App v1.0'))
 * .footer(InfoPanel.columns(['Status: OK', 'Memory: 42MB']));
 *
 * // menu is Menu<'new' | 'open'>
 * ```
 */

/**
 * Content for a single line in an InfoPanel
 * Can be a single string or an array for column distribution
 */
export type LineContent = string | string[];

/**
 * Dynamic content that can be static or reactive
 */
export type DynamicContent<T> = T | (() => T);

/**
 * InfoPanel - Display information in headers or footers with auto-layout
 *
 * Supports:
 * - Single text lines
 * - Multiple lines
 * - Column distribution (2 items = left/right, 3+ = distributed evenly)
 * - Static or reactive content (functions called on each render)
 *
 * @example
 * ```typescript
 * // Simple text
 * InfoPanel.text('No manifest loaded')
 *
 * // Multiple lines
 * InfoPanel.lines(
 *   'My App v1.0',
 *   ['Left aligned', 'Right aligned'],
 *   ['One', 'Two', 'Three', 'Four']  // Distributed
 * )
 *
 * // Reactive content
 * InfoPanel.text(() => `Status: ${getCurrentStatus()}`)
 * ```
 */
export class InfoPanel
{
  /**
   * Create InfoPanel from a single line of text
   */
  static text(content: DynamicContent<string>): InfoPanel
  {
    return new InfoPanel([content], 1);
  }

  /**
   * Create InfoPanel from multiple lines
   * Each line can be a string or array of strings (for column distribution)
   */
  static lines(...lines: DynamicContent<LineContent>[]): InfoPanel
  {
    return new InfoPanel(lines, 1);
  }

  /**
   * Create InfoPanel from columns (single line, distributed)
   * Shorthand for `InfoPanel.lines(['col1', 'col2', ...])`
   */
  static columns(...columns: string[]): InfoPanel
  {
    return new InfoPanel([columns], 1);
  }

  private constructor(
    readonly lines: DynamicContent<LineContent>[],
    private paddingValue: number,
  )
  {}

  /**
   * Set horizontal padding (left/right, defaults to 1)
   */
  padding(value: number): this
  {
    this.paddingValue = value;
    return this;
  }

  /**
   * Get the padding value
   */
  getPadding(): number
  {
    return this.paddingValue;
  }

  /**
   * Resolve dynamic content to static values
   */
  resolve(): LineContent[]
  {
    return this.lines.map((line) =>
    {
      const resolved = typeof line === 'function' ? line() : line;
      return resolved;
    });
  }
}

/**
 * MenuItem - A selectable menu option with type-safe value
 *
 * Uses mutable builder pattern for ergonomic construction.
 * Automatically extracts shortcut keys from [brackets] in labels.
 *
 * @example
 * ```typescript
 * // Auto-extract shortcut from [N]
 * const item = MenuItem.create('new')
 *   .label('[N]ew file')
 *   .help('Create a new file');
 *
 * // Explicit shortcut override
 * const item2 = MenuItem.create('save')
 *   .label('Save')
 *   .shortcut('s')
 *   .help('Save current file');
 * ```
 */
export class MenuItem<T extends string>
{
  /**
   * Create a new MenuItem with the given value
   * The value is used as the return type and must be a literal string
   */
  static create<T extends string>(value: T): MenuItem<T>
  {
    return new MenuItem(value, {});
  }

  private constructor(
    readonly value: T,
    private config: {
      label?: string;
      shortcut?: string;
      help?: string;
      details?: DynamicContent<InfoPanel>;
    },
  )
  {}

  /**
   * Set the display label
   * Automatically extracts shortcut from [X] brackets
   *
   * @example
   * ```typescript
   * item.label('[N]ew file')  // Shortcut: 'n', Display: 'New file'
   * item.label('Save')        // No auto-shortcut
   * ```
   */
  label(text: string): this
  {
    this.config.label = text;

    // Auto-extract shortcut from [X] if not already set
    if (!this.config.shortcut)
    {
      const match = text.match(/\[(.)\]/);
      if (match)
      {
        this.config.shortcut = match[1]!.toLowerCase();
      }
    }

    return this;
  }

  /**
   * Set the keyboard shortcut
   * Overrides any auto-extracted shortcut from label
   */
  shortcut(key: string): this
  {
    this.config.shortcut = key.toLowerCase();
    return this;
  }

  /**
   * Set the help text (displayed dimmed next to the label)
   */
  help(text: string): this
  {
    this.config.help = text;
    return this;
  }

  /**
   * Set the details panel (displayed in split-pane mode on the right side)
   *
   * Supports ergonomic input formats:
   * - String: Auto-wrapped in InfoPanel.text()
   * - String[][]: Auto-wrapped in InfoPanel.lines()
   * - InfoPanel: Used directly
   * - Function: Called reactively on each render
   *
   * @example
   * ```typescript
   * // Simple string (auto-wrapped)
   * item.details('This is a description')
   *
   * // Table data (auto-wrapped)
   * item.details([
   *   ['Name', 'Alice'],
   *   ['Age', '30'],
   *   ['Status', 'Active']
   * ])
   *
   * // Direct InfoPanel (for custom formatting)
   * item.details(InfoPanel.lines('Line 1', ['Left', 'Right']))
   *
   * // Reactive content
   * item.details(() => InfoPanel.text(`Updated: ${new Date()}`))
   * ```
   */
  details(content: string | string[][] | InfoPanel | (() => InfoPanel)): this
  {
    // Normalize to DynamicContent<InfoPanel>
    if (typeof content === 'string')
    {
      this.config.details = InfoPanel.text(content);
    }
    else if (Array.isArray(content))
    {
      // string[][] → InfoPanel.lines(...content)
      this.config.details = InfoPanel.lines(...content);
    }
    else if (content instanceof InfoPanel)
    {
      this.config.details = content;
    }
    else
    {
      // Must be () => InfoPanel
      this.config.details = content;
    }
    return this;
  }

  /**
   * Get the display label (with brackets removed if present)
   */
  getDisplayLabel(): string
  {
    const label = this.config.label ?? this.value;
    return label.replace(/\[(.)\]/, '$1');
  }

  /**
   * Get the shortcut key (for keyboard handling)
   */
  getShortcut(): string | undefined
  {
    return this.config.shortcut;
  }

  /**
   * Get the shortcut character and its position in the label (for highlighting)
   * Returns undefined if no shortcut
   */
  getShortcutPosition(): { char: string; index: number } | undefined
  {
    const label = this.config.label ?? this.value;
    const shortcut = this.config.shortcut;

    if (!shortcut) return undefined;

    // Check if shortcut is in [brackets]
    const bracketMatch = label.match(/\[(.)\]/);
    if (bracketMatch)
    {
      const bracketIndex = label.indexOf('[');
      return { char: bracketMatch[1]!, index: bracketIndex };
    }

    // Otherwise find first occurrence of shortcut char in label
    const index = label.toLowerCase().indexOf(shortcut.toLowerCase());
    if (index >= 0)
    {
      return { char: label[index]!, index };
    }

    return undefined;
  }

  /**
   * Get the help text
   */
  getHelp(): string | undefined
  {
    return this.config.help;
  }

  /**
   * Get the details panel (resolved if dynamic)
   */
  getDetails(): InfoPanel | undefined
  {
    if (!this.config.details) return undefined;

    // Resolve if dynamic
    if (typeof this.config.details === 'function')
    {
      return this.config.details();
    }

    return this.config.details;
  }
}

/**
 * Menu - A collection of MenuItem instances with optional header/footer
 *
 * Maintains type-safe union of all item values.
 * Uses mutable builder pattern for easy construction.
 *
 * @example
 * ```typescript
 * const menu = Menu.create(
 *   MenuItem.create('new').label('[N]ew').help('Create new'),
 *   MenuItem.create('open').label('[O]pen').help('Open file'),
 *   MenuItem.create('quit').label('[Q]uit').help('Exit app')
 * )
 * .header(InfoPanel.text('My App'))
 * .footer(InfoPanel.columns(['v1.0', 'Ready']));
 *
 * // menu is Menu<'new' | 'open' | 'quit'>
 * ```
 */
export class Menu<T extends string>
{
  /**
   * Create a Menu from MenuItems
   * TypeScript infers the union type from the items
   */
  static create<const Items extends MenuItem<string>[]>(
    ...items: Items
  ): Menu<Items[number]['value']>
  {
    return new Menu(items as MenuItem<Items[number]['value']>[]);
  }

  private config: {
    header?: InfoPanel;
    footer?: InfoPanel;
    detailsMinWidth?: number; // Minimum percentage width for details pane (0-100)
  } = {};

  private constructor(
    readonly items: MenuItem<T>[],
  )
  {}

  /**
   * Set the header panel (displayed at top)
   */
  header(panel: InfoPanel): this
  {
    this.config.header = panel;
    return this;
  }

  /**
   * Set the footer panel (displayed at bottom)
   */
  footer(panel: InfoPanel): this
  {
    this.config.footer = panel;
    return this;
  }

  /**
   * Get the header panel
   */
  getHeader(): InfoPanel | undefined
  {
    return this.config.header;
  }

  /**
   * Get the footer panel
   */
  getFooter(): InfoPanel | undefined
  {
    return this.config.footer;
  }

  /**
   * Set the minimum width percentage for the details pane (0-100)
   * Default is 25% if not set
   *
   * @example
   * ```typescript
   * menu.detailsMinWidth(40) // Details pane gets at least 40% of terminal width
   * ```
   */
  detailsMinWidth(percentage: number): this
  {
    this.config.detailsMinWidth = Math.max(0, Math.min(100, percentage));
    return this;
  }

  /**
   * Get the minimum width percentage for the details pane
   */
  getDetailsMinWidth(): number
  {
    return this.config.detailsMinWidth ?? 25; // Default 25%
  }

  /**
   * Find a menu item by its shortcut key
   */
  findByShortcut(key: string): MenuItem<T> | undefined
  {
    return this.items.find((item) => item.getShortcut() === key.toLowerCase());
  }

  /**
   * Get all shortcuts (for validation)
   */
  getShortcuts(): string[]
  {
    return this.items
      .map((item) => item.getShortcut())
      .filter((s): s is string => s !== undefined);
  }
}
