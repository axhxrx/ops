/**
 * Form Primitives for building type-safe, validated forms
 *
 * These primitives separate form structure from rendering, making it easy to construct
 * complex forms with validation, default values, and reactive behavior.
 *
 * @example
 * ```typescript
 * const form = Form.create({
 *   name: FormItem.text('name', '').label('Full Name').required().minLength(2),
 *   email: FormItem.text('email', '').label('Email').pattern(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/),
 *   age: FormItem.number('age', 0).label('Age').validator((v) => v < 0 ? 'Must be positive' : undefined)
 * })
 * .title('User Registration')
 * .header(InfoPanel.text('Please complete this form'));
 * ```
 */

import type { InfoPanel } from './MenuPrimitives.ts';

/**
 * Validator function type - returns error message or undefined if valid
 */
export type Validator<T> = (value: T) => string | undefined;

/**
 * Form field types supported
 */
export type FieldType = 'text' | 'number' | 'boolean' | 'password';

/**
 * FormItem - A single form field with validation and metadata
 *
 * Uses mutable builder pattern for ergonomic construction.
 * Generic over the value type for type safety.
 */
export class FormItem<T>
{
  /**
   * Create a text input field
   */
  static text(key: string, defaultValue: string): FormItem<string>
  {
    return new FormItem(key, 'text', defaultValue);
  }

  /**
   * Create a number input field
   */
  static number(key: string, defaultValue: number): FormItem<number>
  {
    return new FormItem(key, 'number', defaultValue);
  }

  /**
   * Create a boolean input field (yes/no)
   */
  static boolean(key: string, defaultValue: boolean): FormItem<boolean>
  {
    return new FormItem(key, 'boolean', defaultValue);
  }

  /**
   * Create a password input field (masked display)
   */
  static password(key: string, defaultValue: string): FormItem<string>
  {
    return new FormItem(key, 'password', defaultValue);
  }

  private config: {
    label?: string;
    placeholder?: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    validator?: Validator<T>;
    labelColor?: string;
    labelBold?: boolean;
  } = {};

  private constructor(
    readonly key: string,
    readonly type: FieldType,
    readonly defaultValue: T,
  )
  {}

  /**
   * Set the display label for this field
   */
  label(text: string): this
  {
    this.config.label = text;
    return this;
  }

  /**
   * Set placeholder text (for text/number inputs)
   */
  placeholder(text: string): this
  {
    this.config.placeholder = text;
    return this;
  }

  /**
   * Mark this field as required (cannot be empty)
   */
  required(): this
  {
    this.config.required = true;
    return this;
  }

  /**
   * Set minimum length (for text inputs)
   */
  minLength(length: number): this
  {
    this.config.minLength = length;
    return this;
  }

  /**
   * Set maximum length (for text inputs)
   */
  maxLength(length: number): this
  {
    this.config.maxLength = length;
    return this;
  }

  /**
   * Set regex pattern validation (for text inputs)
   */
  pattern(regex: RegExp): this
  {
    this.config.pattern = regex;
    return this;
  }

  /**
   * Set custom validator function
   */
  validator(fn: Validator<T>): this
  {
    this.config.validator = fn;
    return this;
  }

  /**
   * Set label color (e.g., 'cyan', 'red', 'green')
   */
  labelColor(color: string): this
  {
    this.config.labelColor = color;
    return this;
  }

  /**
   * Make label bold
   */
  labelBold(): this
  {
    this.config.labelBold = true;
    return this;
  }

  /**
   * Get the display label
   */
  getLabel(): string
  {
    return this.config.label ?? this.key;
  }

  /**
   * Get the placeholder text
   */
  getPlaceholder(): string | undefined
  {
    return this.config.placeholder;
  }

  /**
   * Check if field is required
   */
  isRequired(): boolean
  {
    return this.config.required ?? false;
  }

  /**
   * Get label color
   */
  getLabelColor(): string | undefined
  {
    return this.config.labelColor;
  }

  /**
   * Get label bold setting
   */
  isLabelBold(): boolean
  {
    return this.config.labelBold ?? false;
  }

  /**
   * Validate a value against all configured validators
   * Returns error message or undefined if valid
   */
  validate(value: T): string | undefined
  {
    // Required check
    if (this.config.required)
    {
      if ((this.type === 'text' || this.type === 'password') && (value as unknown as string).trim() === '')
      {
        return 'This field is required';
      }
      if (this.type === 'number' && (value as unknown as number) === 0)
      {
        // For numbers, we might want a different required check
        // This is debatable - adjust as needed
      }
    }

    // Text-specific validations (applies to both text and password fields)
    if (this.type === 'text' || this.type === 'password')
    {
      const strValue = value as unknown as string;

      // Min length check
      if (this.config.minLength !== undefined && strValue.length < this.config.minLength)
      {
        return `Must be at least ${this.config.minLength} characters`;
      }

      // Max length check
      if (this.config.maxLength !== undefined && strValue.length > this.config.maxLength)
      {
        return `Must be at most ${this.config.maxLength} characters`;
      }

      // Pattern check
      if (this.config.pattern && !this.config.pattern.test(strValue))
      {
        return 'Invalid format';
      }
    }

    // Custom validator
    if (this.config.validator)
    {
      return this.config.validator(value);
    }

    return undefined;
  }
}

/**
 * Extract the value type from a FormItem
 */
type FormItemValue<T> = T extends FormItem<infer V> ? V : never;

/**
 * Convert a record of FormItems to a record of their value types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormValues<T extends Record<string, FormItem<any>>> = {
  [K in keyof T]: FormItemValue<T[K]>;
};

/**
 * Form - A collection of FormItems with optional header/footer/title
 *
 * Maintains type-safe mapping of field keys to value types.
 * Uses mutable builder pattern for easy construction.
 *
 * @example
 * ```typescript
 * const form = Form.create({
 *   name: FormItem.text('name', '').label('Name').required(),
 *   email: FormItem.text('email', '').label('Email').pattern(/^.+@.+$/),
 *   age: FormItem.number('age', 0).label('Age')
 * })
 * .title('User Form')
 * .header(InfoPanel.text('Fill out your details'));
 *
 * // form is Form<{ name: string, email: string, age: number }>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Form<T extends Record<string, FormItem<any>>>
{
  /**
   * Create a Form from a record of FormItems
   * TypeScript infers the value types from the items
   */
  static create<T extends Record<string, FormItem<unknown>>>(items: T): Form<T>
  {
    return new Form(items);
  }

  private config: {
    title?: string;
    header?: InfoPanel;
    footer?: InfoPanel;
  } = {};

  private constructor(readonly items: T)
  {}

  /**
   * Set the form title (displayed at top)
   */
  title(text: string): this
  {
    this.config.title = text;
    return this;
  }

  /**
   * Set the header panel (displayed below title)
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
   * Get the form title
   */
  getTitle(): string | undefined
  {
    return this.config.title;
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
   * Get all form items as an array
   */
  getItems(): FormItem<unknown>[]
  {
    return Object.values(this.items);
  }

  /**
   * Get default values for all fields
   */
  getDefaultValues(): FormValues<T>
  {
    const values: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(this.items))
    {
      values[key] = item.defaultValue;
    }
    return values as FormValues<T>;
  }

  /**
   * Validate all fields in the form
   * Returns a record of field keys to error messages (only for fields with errors)
   */
  validateAll(values: FormValues<T>): Record<string, string>
  {
    const errors: Record<string, string> = {};

    for (const [key, item] of Object.entries(this.items))
    {
      const value = values[key as keyof FormValues<T>];
      const error = item.validate(value);
      if (error)
      {
        errors[key] = error;
      }
    }

    return errors;
  }
}
