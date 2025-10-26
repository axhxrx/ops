# ShowFormOp - Interactive Form UI

A full-featured form UI operation following the Ops Pattern, with type-safe builder API and comprehensive validation.

## Features

- **Type-safe form building** with fluent builder API
- **Multi-field support**: text, number, and boolean inputs
- **Tab/Shift+Tab navigation** between fields
- **Real-time validation** with error display
- **Full-screen rendering** with terminal height filling
- **Visual field highlighting** (active field shown in cyan inverse)
- **Comprehensive validation**: required, minLength, maxLength, pattern, custom validators
- **Builder pattern** similar to MenuPrimitives for easy form construction

## Quick Start

### Basic Contact Form

```typescript
import { Form, FormItem } from './FormPrimitives.ts';
import { InfoPanel } from './MenuPrimitives.ts';
import { ShowFormOp } from './ShowFormOp.tsx';

const contactForm = Form.create({
  name: FormItem.text('name', '')
    .label('Full Name')
    .required()
    .minLength(2)
    .maxLength(50)
    .labelColor('cyan'),

  email: FormItem.text('email', '')
    .label('Email Address')
    .required()
    .pattern(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/)
    .placeholder('user@example.com'),

  message: FormItem.text('message', '')
    .label('Message')
    .minLength(10)
    .placeholder('Type your message here...')
})
.title('📧 Contact Form')
.header(InfoPanel.text('Please fill out your contact information'))
.footer(InfoPanel.text('Fields marked with * are required'));

const op = new ShowFormOp(contactForm, { cancelable: true });
const result = await op.run();

if (result.ok && result.value.type === 'submitted') {
  console.log('Name:', result.value.values.name);
  console.log('Email:', result.value.values.email);
  console.log('Message:', result.value.values.message);
}
```

### Registration Form with Mixed Field Types

```typescript
const registrationForm = Form.create({
  username: FormItem.text('username', '')
    .label('Username')
    .required()
    .minLength(3)
    .maxLength(20)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .placeholder('my_username'),

  age: FormItem.number('age', 0)
    .label('Age')
    .validator((v) => v < 13 ? 'Must be 13 or older' : undefined),

  newsletter: FormItem.boolean('newsletter', false)
    .label('Subscribe to newsletter?'),

  terms: FormItem.boolean('terms', false)
    .label('Accept terms & conditions')
    .required()
    .validator((v) => !v ? 'You must accept the terms' : undefined)
})
.title('👤 User Registration');

const op = new ShowFormOp(registrationForm, { cancelable: true });
const result = await op.run();
```

## FormItem API

### Text Fields

```typescript
FormItem.text(key: string, defaultValue: string)
  .label(text: string)              // Display label
  .required()                       // Mark as required
  .minLength(length: number)        // Minimum length validation
  .maxLength(length: number)        // Maximum length validation
  .pattern(regex: RegExp)           // Regex pattern validation
  .placeholder(text: string)        // Placeholder text
  .validator(fn: (value: string) => string | undefined)  // Custom validator
  .labelColor(color: string)        // Label color
  .labelBold()                      // Make label bold
```

### Number Fields

```typescript
FormItem.number(key: string, defaultValue: number)
  .label(text: string)
  .validator(fn: (value: number) => string | undefined)
  .labelColor(color: string)
  .labelBold()
```

### Boolean Fields

```typescript
FormItem.boolean(key: string, defaultValue: boolean)
  .label(text: string)
  .required()
  .validator(fn: (value: boolean) => string | undefined)
  .labelColor(color: string)
  .labelBold()
```

## Form API

```typescript
Form.create({
  field1: FormItem.text('field1', ''),
  field2: FormItem.number('field2', 0),
  field3: FormItem.boolean('field3', false)
})
.title(text: string)          // Form title
.header(panel: InfoPanel)     // Header panel (from MenuPrimitives)
.footer(panel: InfoPanel)     // Footer panel
```

## Keyboard Navigation

- **Tab**: Move to next field
- **Shift+Tab**: Move to previous field
- **Enter**: Submit form (or move to next field if not on last field)
- **Ctrl+Enter**: Submit form from any field
- **Escape**: Cancel (if cancelable option is true)
- **Backspace**: Delete character (text/number fields)
- **y/n/Space**: Toggle boolean fields

## Success/Failure Types

### Success Type (Discriminated Union)

```typescript
type ShowFormOpSuccess<T> = {
  type: 'submitted';
  values: T;
};
```

### Failure Types

```typescript
type ShowFormOpFailure = 'canceled' | 'unknownError';
```

## Validation

Validation happens:
1. **On submit attempt**: All fields are validated when user tries to submit
2. **Real-time after first attempt**: After first submit attempt, validation runs on every keystroke
3. **Progressive disclosure**: Errors only shown after user has attempted to submit

### Validation Rules Priority

1. Required check
2. Min/max length (for text)
3. Pattern matching (for text)
4. Custom validator

### Custom Validators

```typescript
.validator((value) => {
  if (someCondition) return 'Error message';
  return undefined; // Valid
})
```

## Visual Design

- **Active field**: Cyan inverse highlighting
- **Labels**: Right-aligned in label column
- **Inputs**: Left-aligned in input column
- **Errors**: Red text with ❌ emoji, displayed below field
- **Required fields**: Marked with asterisk (*)
- **Boolean fields**: Shows "Yes" or "No" with toggle hint
- **Placeholders**: Dimmed text for empty fields

## Examples

See [ShowFormOp.tsx](./ShowFormOp.tsx) for 4 comprehensive demo scenarios:

1. **Contact Form** - Simple form with text validation
2. **User Registration** - Mixed field types (text, number, boolean)
3. **Application Settings** - Configuration form
4. **Validation Showcase** - Complex validation rules

## Running the Demos

```bash
# Make executable
chmod +x ShowFormOp.tsx

# Run all demos
bun ShowFormOp.tsx

# Or run directly
./ShowFormOp.tsx
```

## Testing

```bash
bun test ShowFormOp.test.ts
```

Tests cover:
- FormItem creation and configuration
- Validation logic (required, minLength, maxLength, pattern, custom)
- Form creation with typed fields
- Default values extraction
- Multi-field validation
- Header/footer/title support

## Type Safety

The form system is fully type-safe:

```typescript
const form = Form.create({
  name: FormItem.text('name', ''),
  age: FormItem.number('age', 0),
  subscribe: FormItem.boolean('subscribe', false)
});

// TypeScript knows the shape of the result
const result = await new ShowFormOp(form).run();

if (result.ok && result.value.type === 'submitted') {
  const values = result.value.values;
  // values.name is string
  // values.age is number
  // values.subscribe is boolean
}
```

## Integration with Ops Pattern

ShowFormOp follows the Ops Pattern:

- Extends `Op` base class
- Returns strongly-typed `Outcome<Success, Failure>`
- Integrates with `IOContext` for stdin/stdout
- Supports logging via `IOContext.logger`
- Can be used with `OpRunner` for stack-based execution
- Fully testable and auditable

## Future Enhancements

Potential additions:
- Password masking for sensitive text fields
- Date/time pickers
- Multi-line text areas
- Select/dropdown fields
- Radio button groups
- Checkbox groups
- Field dependencies (enable/disable based on other fields)
- Async validators
- Form-level validation (compare password fields, etc.)
- File upload fields
- Auto-focus on first invalid field after submit
