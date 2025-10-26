#!/usr/bin/env bun

import { render } from "ink";
import type { Form, FormItem } from "./FormPrimitives.ts";
import type { IOContext } from "./IOContext.ts";
import { Op } from "./Op.ts";
import type { Failure, Success } from "./Outcome.ts";
import { FormView } from "./ShowFormOp.ui.tsx";

/**
 * Success result from ShowFormOp - discriminated union for type-safe exhaustive checking
 */
export type ShowFormOpSuccess<T> = {
  type: "submitted";
  values: T;
};

/**
 * Failure types from ShowFormOp
 */
export type ShowFormOpFailure = "canceled" | "unknownError";

/**
 * Options for ShowFormOp
 */
export type ShowFormOpOptions = {
  /**
   * Allow user to press Escape to cancel
   */
  cancelable?: boolean;

  /**
   * Fill terminal height by adding spacer (naturally pushes old content up, default: true)
   */
  fillHeight?: boolean;
};

/**
 * ShowFormOp - Display an interactive form with validation
 *
 * Provides a full-screen form UI with:
 * - Tab/Shift+Tab navigation between fields
 * - Real-time validation feedback
 * - Support for text, number, and boolean fields
 * - Type-safe form definition and results
 *
 * Success value: `{ type: 'submitted', values: T }` where T is inferred from the Form definition
 * Failure: 'canceled' | 'unknownError'
 *
 * @example Simple contact form
 * ```typescript
 * import { Form, FormItem } from './FormPrimitives';
 * import { InfoPanel } from './MenuPrimitives';
 *
 * const contactForm = Form.create({
 *   name: FormItem.text('name', '')
 *     .label('Name')
 *     .required()
 *     .minLength(2)
 *     .maxLength(50),
 *   email: FormItem.text('email', '')
 *     .label('Email')
 *     .required()
 *     .pattern(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/),
 *   message: FormItem.text('message', '')
 *     .label('Message')
 *     .minLength(10)
 * })
 * .title('Contact Form')
 * .header(InfoPanel.text('Please fill out your contact information'))
 * .footer(InfoPanel.text('All fields marked with * are required'));
 *
 * const op = new ShowFormOp(contactForm, { cancelable: true });
 * const result = await op.run();
 *
 * if (result.ok && result.value.type === 'submitted') {
 *   console.log('Name:', result.value.values.name);
 *   console.log('Email:', result.value.values.email);
 *   console.log('Message:', result.value.values.message);
 * }
 * ```
 *
 * @example Registration form with multiple field types
 * ```typescript
 * const registrationForm = Form.create({
 *   username: FormItem.text('username', '')
 *     .label('Username')
 *     .required()
 *     .minLength(3)
 *     .maxLength(20)
 *     .pattern(/^[a-zA-Z0-9_]+$/),
 *   age: FormItem.number('age', 0)
 *     .label('Age')
 *     .validator((v) => v < 13 ? 'Must be 13 or older' : undefined),
 *   newsletter: FormItem.boolean('newsletter', false)
 *     .label('Subscribe to newsletter?')
 * })
 * .title('User Registration');
 *
 * const op = new ShowFormOp(registrationForm);
 * const result = await op.run();
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ShowFormOp<T extends Record<string, FormItem<any>>> extends Op {
  name = "ShowFormOp";

  constructor(private form: Form<T>, private options: ShowFormOpOptions = {}) {
    super();
  }

  // Explicit return type needed for proper type inference
  async run(
    io?: IOContext
  ): Promise<
    | Success<ShowFormOpSuccess<Record<string, unknown>>>
    | Failure<ShowFormOpFailure>
  > {
    const ioContext = this.getIO(io);

    let result: ShowFormOpSuccess<Record<string, unknown>> | "canceled" | null =
      null;

    const { unmount, waitUntilExit } = render(
      <FormView
        form={this.form}
        fillHeight={this.options.fillHeight ?? true}
        logger={ioContext.logger}
        onSubmit={(values) => {
          this.log(io, `Form submitted: ${JSON.stringify(values)}`);
          result = { type: "submitted", values };
          unmount();
        }}
        onCancel={
          this.options.cancelable
            ? () => {
                this.log(io, "Form canceled");
                result = "canceled";
                unmount();
              }
            : undefined
        }
      />,
      {
        stdin: ioContext.stdin as NodeJS.ReadStream,
        stdout: ioContext.stdout as NodeJS.WriteStream,
      }
    );

    await waitUntilExit();

    // Handle outcomes
    if (result === null) {
      return this.failWithUnknownError("No result from form view");
    }

    if (result === "canceled") {
      return this.cancel();
    }

    return this.succeed(result);
  }
}

import { parseArgs } from "./main.ts";
import { main } from "./main.ts";
if (import.meta.main) {
  const parsedArgs = parseArgs();

  const { Form, FormItem } = await import("./FormPrimitives.ts");
  const { InfoPanel } = await import("./MenuPrimitives.ts");

  console.log("🎬 ShowFormOp Demo\n");

  // Demo 1: Simple contact form
  console.log("Example 1: Contact Form (with validation)\n");

  const contactForm = Form.create({
    name: FormItem.text("name", "")
      .label("Full Name")
      .required()
      .minLength(2)
      .maxLength(50)
      .labelColor("cyan")
      .labelBold(),
    email: FormItem.text("email", "")
      .label("Email Address")
      .required()
      .pattern(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/)
      .placeholder("user@example.com")
      .labelColor("cyan"),
    message: FormItem.text("message", "")
      .label("Message")
      .minLength(10)
      .maxLength(200)
      .placeholder("Type your message here...")
      .labelColor("cyan"),
  })
    .title("📧 Contact Form")
    .header(InfoPanel.text("Please fill out your contact information"))
    .footer(
      InfoPanel.text(
        "Fields marked with * are required | Tab: Next | Enter: Submit | Esc: Cancel"
      )
    );

  const contactOp = new ShowFormOp(contactForm, { cancelable: true });

  // const contactResult = await contactOp.run();

  console.log(parsedArgs);
  const contactResult = await main(parsedArgs, contactOp);

  if (contactResult.ok && contactResult.value.type === "submitted") {
    const values = contactResult.value.values;
    console.log("\n✅ Contact form submitted successfully!");
    console.log(`Name: ${String(values.name)}`);
    console.log(`Email: ${String(values.email)}`);
    console.log(`Message: ${(values.message as string) || "(empty)"}`);
  } else if (
    contactResult.ok === false &&
    contactResult.failure === "canceled"
  ) {
    console.log("\n🚫 Contact form canceled");
  } else {
    console.log("\n❌ Error:", contactResult);
  }

  console.log("\n" + "=".repeat(80) + "\n");

  // Demo 2: Registration form with mixed field types
  console.log("Example 2: User Registration (mixed field types)\n");

  const registrationForm = Form.create({
    username: FormItem.text("username", "")
      .label("Username")
      .required()
      .minLength(3)
      .maxLength(20)
      .pattern(/^[a-zA-Z0-9_]+$/)
      .placeholder("my_username")
      .labelColor("green")
      .labelBold(),
    password: FormItem.password("password", "")
      .label("Password")
      .required()
      .minLength(8)
      .placeholder("********")
      .labelColor("green"),
    age: FormItem.number("age", 0)
      .label("Age")
      .validator((v) =>
        v < 13 ? "Must be 13 or older" : v > 120 ? "Invalid age" : undefined
      )
      .labelColor("green"),
    newsletter: FormItem.boolean("newsletter", false)
      .label("Subscribe to newsletter?")
      .labelColor("green"),
    terms: FormItem.boolean("terms", false)
      .label("Accept terms & conditions")
      .required()
      .validator((v) => (!v ? "You must accept the terms" : undefined))
      .labelColor("green"),
  })
    .title("👤 User Registration")
    .header(
      InfoPanel.lines(
        "Create your account",
        "",
        "Username must be 3-20 characters (letters, numbers, underscore only)"
      )
    )
    .footer(
      InfoPanel.text(
        "Tab/Shift+Tab: Navigate | y/n/space: Toggle boolean | Enter: Submit"
      )
    );

  const registrationOp = new ShowFormOp(registrationForm, { cancelable: true });
  const registrationResult = await registrationOp.run();

  if (registrationResult.ok && registrationResult.value.type === "submitted") {
    const values = registrationResult.value.values;
    console.log("\n✅ Registration successful!");
    console.log(`Username: ${String(values.username)}`);
    console.log(
      `Password: ${"*".repeat((values.password as string).length)} (masked)`
    );
    console.log(`Age: ${String(values.age)}`);
    console.log(`Newsletter: ${values.newsletter ? "Yes" : "No"}`);
    console.log(`Terms accepted: ${values.terms ? "Yes" : "No"}`);
  } else if (
    registrationResult.ok === false &&
    registrationResult.failure === "canceled"
  ) {
    console.log("\n🚫 Registration canceled");
  }

  console.log("\n" + "=".repeat(80) + "\n");

  // Demo 3: Settings form
  console.log("Example 3: Application Settings\n");

  const settingsForm = Form.create({
    apiKey: FormItem.text("apiKey", "")
      .label("API Key")
      .required()
      .minLength(32)
      .maxLength(64)
      .placeholder("Enter your API key")
      .labelColor("yellow"),
    timeout: FormItem.number("timeout", 30)
      .label("Timeout (seconds)")
      .validator((v) =>
        v < 1
          ? "Must be at least 1 second"
          : v > 300
          ? "Maximum 300 seconds"
          : undefined
      )
      .labelColor("yellow"),
    enableLogging: FormItem.boolean("enableLogging", true)
      .label("Enable logging")
      .labelColor("yellow"),
    enableCache: FormItem.boolean("enableCache", true)
      .label("Enable caching")
      .labelColor("yellow"),
  })
    .title("⚙️  Application Settings")
    .header(
      InfoPanel.lines(
        "Configure your application settings",
        ["Setting", "Description"],
        ["API Key", "Your unique authentication key"],
        ["Timeout", "Request timeout in seconds"]
      )
    )
    .footer(
      InfoPanel.columns("Status: Ready", "Press Enter to save", "Esc to cancel")
    );

  const settingsOp = new ShowFormOp(settingsForm, { cancelable: true });
  const settingsResult = await settingsOp.run();

  if (settingsResult.ok && settingsResult.value.type === "submitted") {
    const values = settingsResult.value.values;
    console.log("\n✅ Settings saved!");
    console.log(`API Key: ${String(values.apiKey)}`);
    console.log(`Timeout: ${String(values.timeout)} seconds`);
    console.log(`Logging: ${values.enableLogging ? "Enabled" : "Disabled"}`);
    console.log(`Caching: ${values.enableCache ? "Enabled" : "Disabled"}`);
  } else if (
    settingsResult.ok === false &&
    settingsResult.failure === "canceled"
  ) {
    console.log("\n🚫 Settings not saved");
  }

  console.log("\n" + "=".repeat(80) + "\n");

  // Demo 4: Validation showcase
  console.log("Example 4: Validation Showcase\n");

  const validationForm = Form.create({
    email: FormItem.text("email", "")
      .label("Email")
      .required()
      .pattern(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/)
      .placeholder("test@example.com")
      .labelColor("magenta"),
    password: FormItem.text("password", "")
      .label("Password")
      .required()
      .minLength(8)
      .validator((v) => {
        if (!/[A-Z]/.test(v)) return "Must contain uppercase letter";
        if (!/[a-z]/.test(v)) return "Must contain lowercase letter";
        if (!/[0-9]/.test(v)) return "Must contain number";
        return undefined;
      })
      .placeholder("Min 8 chars, uppercase, lowercase, number")
      .labelColor("magenta"),
    confirmPassword: FormItem.text("confirmPassword", "")
      .label("Confirm Password")
      .required()
      .validator((v) => {
        // Note: This is a simple demo - in real usage you'd compare with password field
        // For now we just check it's not empty since we marked it required
        return v.length < 8 ? "Must match password" : undefined;
      })
      .labelColor("magenta"),
  })
    .title("🔒 Validation Showcase")
    .header(InfoPanel.text("This form demonstrates various validation rules"))
    .footer(
      InfoPanel.text(
        "Try submitting with invalid data to see validation errors"
      )
    );

  const validationOp = new ShowFormOp(validationForm, { cancelable: true });
  const validationResult = await validationOp.run();

  if (validationResult.ok && validationResult.value.type === "submitted") {
    const values = validationResult.value.values;
    console.log("\n✅ Validation passed!");
    console.log(`Email: ${String(values.email)}`);
    console.log(`Password: ${"*".repeat((values.password as string).length)}`);
  } else if (
    validationResult.ok === false &&
    validationResult.failure === "canceled"
  ) {
    console.log("\n🚫 Form canceled");
  }

  console.log("\n" + "=".repeat(80) + "\n");

  console.log("🎉 All demos complete!");
}
