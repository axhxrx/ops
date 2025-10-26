import { describe, expect, test } from 'bun:test';
import { Form, FormItem } from './FormPrimitives.ts';

describe('FormPrimitives', () =>
{
  describe('FormItem', () =>
  {
    test('creates text field with validation', () =>
    {
      const field = FormItem.text('name', '')
        .label('Full Name')
        .required()
        .minLength(2)
        .maxLength(50);

      expect(field.key).toBe('name');
      expect(field.type).toBe('text');
      expect(field.getLabel()).toBe('Full Name');
      expect(field.isRequired()).toBe(true);
    });

    test('validates required text field', () =>
    {
      const field = FormItem.text('name', '').required();

      const error = field.validate('');
      expect(error).toBe('This field is required');

      const valid = field.validate('John');
      expect(valid).toBeUndefined();
    });

    test('validates minLength', () =>
    {
      const field = FormItem.text('name', '').minLength(3);

      const error = field.validate('ab');
      expect(error).toBe('Must be at least 3 characters');

      const valid = field.validate('abc');
      expect(valid).toBeUndefined();
    });

    test('validates maxLength', () =>
    {
      const field = FormItem.text('name', '').maxLength(5);

      const error = field.validate('abcdef');
      expect(error).toBe('Must be at most 5 characters');

      const valid = field.validate('abc');
      expect(valid).toBeUndefined();
    });

    test('validates pattern', () =>
    {
      const field = FormItem.text('email', '').pattern(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/);

      const error = field.validate('invalid');
      expect(error).toBe('Invalid format');

      const valid = field.validate('test@example.com');
      expect(valid).toBeUndefined();
    });

    test('validates custom validator', () =>
    {
      const field = FormItem.number('age', 0).validator((v) => v < 13 ? 'Must be 13 or older' : undefined);

      const error = field.validate(12);
      expect(error).toBe('Must be 13 or older');

      const valid = field.validate(18);
      expect(valid).toBeUndefined();
    });

    test('creates number field', () =>
    {
      const field = FormItem.number('age', 0).label('Age');

      expect(field.key).toBe('age');
      expect(field.type).toBe('number');
      expect(field.defaultValue).toBe(0);
    });

    test('creates boolean field', () =>
    {
      const field = FormItem.boolean('subscribe', false).label('Subscribe');

      expect(field.key).toBe('subscribe');
      expect(field.type).toBe('boolean');
      expect(field.defaultValue).toBe(false);
    });
  });

  describe('Form', () =>
  {
    test('creates form with typed fields', () =>
    {
      const form = Form.create({
        name: FormItem.text('name', '').label('Name'),
        age: FormItem.number('age', 0).label('Age'),
        subscribe: FormItem.boolean('subscribe', false).label('Subscribe'),
      });

      const items = form.getItems();
      expect(items).toHaveLength(3);
      expect(items[0]?.key).toBe('name');
      expect(items[1]?.key).toBe('age');
      expect(items[2]?.key).toBe('subscribe');
    });

    test('gets default values', () =>
    {
      const form = Form.create({
        name: FormItem.text('name', 'John').label('Name'),
        age: FormItem.number('age', 25).label('Age'),
        subscribe: FormItem.boolean('subscribe', true).label('Subscribe'),
      });

      const defaults = form.getDefaultValues();
      expect(defaults.name).toBe('John');
      expect(defaults.age).toBe(25);
      expect(defaults.subscribe).toBe(true);
    });

    test('validates all fields', () =>
    {
      const form = Form.create({
        name: FormItem.text('name', '').required().minLength(2),
        email: FormItem.text('email', '').pattern(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/),
      });

      const errors = form.validateAll({
        name: '',
        email: 'invalid',
      });

      expect(errors.name).toBe('This field is required');
      expect(errors.email).toBe('Invalid format');
    });

    test('returns empty errors for valid form', () =>
    {
      const form = Form.create({
        name: FormItem.text('name', '').required().minLength(2),
        email: FormItem.text('email', '').pattern(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/),
      });

      const errors = form.validateAll({
        name: 'John Doe',
        email: 'john@example.com',
      });

      expect(Object.keys(errors)).toHaveLength(0);
    });

    test('supports title, header, and footer', async () =>
    {
      const { InfoPanel } = await import('./MenuPrimitives.ts');

      const form = Form.create({
        name: FormItem.text('name', '').label('Name'),
      })
        .title('Test Form')
        .header(InfoPanel.text('Header text'))
        .footer(InfoPanel.text('Footer text'));

      expect(form.getTitle()).toBe('Test Form');
      expect(form.getHeader()).toBeDefined();
      expect(form.getFooter()).toBeDefined();
    });
  });
});
