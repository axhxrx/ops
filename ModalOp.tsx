#!/usr/bin/env bun

import { render } from 'ink';
import type { IOContext } from './IOContext';
import { ModalView } from './ModalOp.ui';
import { Op } from './Op';

/**
 * ModalOp - Full-screen BRUTALIST cyberpunk modal with Matrix rain background
 *
 * Features:
 * - Animated Matrix-style falling characters in background (toggleable)
 * - Centered modal with 8-bit drop shadow (brutalist style)
 * - Solid color rectangles - no borders, just rectangles with drop shadows
 * - Configurable title, message, and button labels
 * - Optional cancel button
 * - Keyboard navigation (arrows, Tab, Enter, Esc, Y/N)
 * - Green confirm button, red cancel button
 * - Cyan modal background, black text
 *
 * Success value: 'confirmed'
 * Failure: 'canceled' if user cancels
 *
 * @example Simple confirmation
 * ```typescript
 * const op = new ModalOp({
 *   title: 'Confirm Action',
 *   message: 'Are you sure you want to proceed?',
 * });
 * const result = await op.run();
 *
 * if (result.ok) {
 *   console.log('User confirmed!');
 * }
 * ```
 *
 * @example Custom buttons with animation disabled
 * ```typescript
 * const op = new ModalOp({
 *   title: 'Delete File',
 *   message: 'This action cannot be undone. Are you sure?',
 *   confirmLabel: 'Delete',
 *   cancelLabel: 'Keep',
 *   showCancel: true,
 *   animate: false, // Disable matrix rain animation
 * });
 * ```
 *
 * @example Alert (no cancel)
 * ```typescript
 * const op = new ModalOp({
 *   title: 'Success',
 *   message: 'Your file has been saved successfully!',
 *   confirmLabel: 'Got it',
 *   showCancel: false,
 * });
 * ```
 */
export class ModalOp extends Op
{
  name = 'ModalOp';

  constructor(
    private config: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      confirmColor?: 'green' | 'red' | 'yellow' | 'magenta';
      cancelColor?: 'green' | 'red' | 'yellow' | 'magenta';
      showCancel?: boolean;
      animate?: boolean;
    },
  )
  {
    super();
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();
    const ioContext = this.getIO(io);

    let wasConfirmed = false;
    let wasCanceled = false;

    const { unmount, waitUntilExit } = render(
      <ModalView
        title={this.config.title}
        message={this.config.message}
        confirmLabel={this.config.confirmLabel}
        cancelLabel={this.config.cancelLabel}
        confirmColor={this.config.confirmColor}
        cancelColor={this.config.cancelColor}
        showCancel={this.config.showCancel ?? true}
        animate={this.config.animate ?? true}
        logger={ioContext.logger}
        onConfirm={() =>
        {
          this.log(io, 'Modal confirmed');
          wasConfirmed = true;
          unmount();
        }}
        onCancel={() =>
        {
          this.log(io, 'Modal canceled');
          wasCanceled = true;
          unmount();
        }}
      />,
      {
        stdin: ioContext.stdin as NodeJS.ReadStream,
        stdout: ioContext.stdout as NodeJS.WriteStream,
      },
    );

    await waitUntilExit();

    if (wasCanceled)
    {
      return this.cancel();
    }

    if (wasConfirmed)
    {
      return this.succeed('confirmed' as const);
    }

    return this.failWithUnknownError('Modal closed without confirmation or cancel');
  }
}

if (import.meta.main)
{
  console.log('🚀 ModalOp Examples - Cyberpunk Dialogs\n');

  // Example 1: Simple confirmation
  const modal1 = new ModalOp({
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed with this operation?',
  });

  const result1 = await modal1.run();

  if (result1.ok)
  {
    console.log('\n✅ User confirmed!');
  }
  else if (result1.failure === 'canceled')
  {
    console.log('\n🚫 User canceled');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Example 2: Destructive action (confirm button is RED for danger!)
  const modal2 = new ModalOp({
    title: 'Delete File',
    message:
      'This will permanently delete the file "important-data.txt".\n\nThis action cannot be undone. Are you absolutely sure?',
    confirmLabel: 'Delete',
    cancelLabel: 'Keep File',
    confirmColor: 'red', // RED for dangerous action!
    cancelColor: 'green', // GREEN to keep (safe action)
  });

  const result2 = await modal2.run();

  if (result2.ok)
  {
    console.log('\n✅ File deleted');
  }
  else
  {
    console.log('\n🚫 File kept');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Example 3: Alert (no cancel)
  const modal3 = new ModalOp({
    title: 'Success',
    message: 'Your changes have been saved successfully!\n\nAll data has been synchronized to the cloud.',
    confirmLabel: 'Got it',
    showCancel: false,
  });

  const result3 = await modal3.run();

  if (result3.ok)
  {
    console.log('\n✅ User acknowledged');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Example 4: Long message
  const modal4 = new ModalOp({
    title: 'Terms and Conditions',
    message: 'By proceeding, you agree to the following terms:\n\n'
      + '1. All data will be encrypted using military-grade AES-256 encryption.\n'
      + '2. Your privacy is our top priority and we will never share your data.\n'
      + '3. You can revoke access at any time from your account settings.\n\n'
      + 'Do you accept these terms?',
    confirmLabel: 'Accept',
    cancelLabel: 'Decline',
  });

  const result4 = await modal4.run();

  if (result4.ok)
  {
    console.log('\n✅ Terms accepted');
  }
  else
  {
    console.log('\n🚫 Terms declined');
  }

  console.log('\n🎉 All examples complete!');
}
