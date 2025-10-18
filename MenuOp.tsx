#!/usr/bin/env bun

import { render } from 'ink';
import chalk from 'chalk';
import type { IOContext } from './IOContext';
import { Op } from './Op';
import type { Menu } from './MenuPrimitives';
import { MenuView } from './MenuOp.ui';

/**
 * MenuOp - Rich, type-safe menu with auto-layout and keyboard shortcuts
 *
 * Uses the Menu primitive for ergonomic construction and maintains type safety.
 * Supports headers, footers, keyboard shortcuts, and reactive content.
 *
 * Success value: T (the value of the selected MenuItem)
 * Failure: 'canceled' if user presses Escape
 *
 * @example
 * ```typescript
 * import { Menu, MenuItem, InfoPanel } from './MenuPrimitives';
 *
 * const menu = Menu.create(
 *   MenuItem.create('new').label('[N]ew file').help('Create a new file'),
 *   MenuItem.create('open').label('[O]pen file').help('Open existing file'),
 *   MenuItem.create('quit').label('[Q]uit').help('Exit the application')
 * )
 * .header(InfoPanel.text('My Application v1.0'))
 * .footer(InfoPanel.columns(['Status: Ready', 'Memory: 42MB']));
 *
 * const op = new MenuOp(menu, { cancelable: true });
 * const result = await op.run();
 *
 * if (result.ok) {
 *   console.log('Selected:', result.value); // 'new' | 'open' | 'quit'
 * }
 * ```
 */
export class MenuOp<T extends string> extends Op
{
  name = 'MenuOp';

  constructor(
    private menu: Menu<T>,
    private options: {
      cancelable?: boolean;
      /**
       * Fill terminal height by adding spacer (naturally pushes old content up, default: true)
       */
      fillHeight?: boolean;
    } = {},
  )
  {
    super();
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();
    const ioContext = this.getIO(io);

    let selectedValue: T | null = null;
    let wasCanceled = false;

    const { unmount, waitUntilExit } = render(
      <MenuView
        menu={this.menu}
        logger={ioContext.logger}
        fillHeight={this.options.fillHeight ?? true}
        onSelect={(value) =>
        {
          this.log(io, `Selected: ${value}`);
          selectedValue = value;
          unmount();
        }}
        onCancel={
          this.options.cancelable
            ? () =>
            {
              this.log(io, 'Canceled');
              wasCanceled = true;
              unmount();
            }
            : undefined
        }
      />,
    );

    await waitUntilExit();

    if (wasCanceled)
    {
      return this.cancel();
    }

    if (selectedValue === null)
    {
      return this.failWithUnknownError('No menu item selected');
    }

    return this.succeed(selectedValue);
  }
}

if (import.meta.main)
{
  const { Menu, MenuItem, InfoPanel } = await import('./MenuPrimitives');

  // Don't use console.log before Ink renders - it confuses the layout!
  // console.log('='.repeat(80));
  // console.log('MenuOp Examples - Kick-Ass Menus');
  // console.log('='.repeat(80));
  // console.log();

  // Example 1: Simple menu matching the user's first mockup
  // console.log('Example 1: Manifest loader menu\n');

  const menu1 = Menu.create(
    MenuItem.create('new' as const)
      .label('[N]ew manifest')
      .help('create new manifest'),
    MenuItem.create('local' as const)
      .label('[L]ocal manifest')
      .help('load from local filesystem'),
    MenuItem.create('remote' as const)
      .label('[R]emote manifest')
      .help('load from S3-compatible store'),
    MenuItem.create('url' as const)
      .label('[U]RL manifest')
      .help('load from URL'),
  )
    .header(InfoPanel.text('No manifest loaded'))
    .footer(InfoPanel.columns('466.7 kWh', 'foo hoge bar', '39.3MB'));

  const op1 = new MenuOp(menu1, { cancelable: true });
  const result1 = await op1.run();

  if (result1.ok)
  {
    const selected: string = result1.value;
    console.log(`\n✅ Selected: ${selected}`);
  }
  else if (result1.failure === 'canceled')
  {
    console.log('\n🚫 Canceled');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Example 2: Menu with multi-line header and reactive content
  // console.log('Example 2: Menu with detailed header and reactive status\n');

  // Simulate dynamic status
  let buildStatus: 'Idle' | 'Building' | 'Complete' = 'Building';

  const menu2 = Menu.create(
    MenuItem.create('build' as const)
      .label('[B]uild')
      .help('start build process'),
    MenuItem.create('deploy' as const)
      .label('[D]eploy')
      .help('deploy to production'),
    MenuItem.create('test' as const)
      .label('[T]est')
      .help('run test suite'),
    MenuItem.create('cancel' as const)
      .label('[C]ancel')
      .help('cancel operation'),
  )
    .header(
      InfoPanel.lines(
        () => `My test manifest.vmnfst                     ${chalk.yellow(`[${buildStatus}]`)}`,
        'Source: /Volumes/4TB/test-data/Toyota001/*',
        () => `Docs: 137   Size: 14.MB  Strategy: serial-001 (Claude)`,
      ),
    )
    .footer(InfoPanel.columns('466.7 kWh', 'foo hoge bar', '39.3MB'));

  const op2 = new MenuOp(menu2, { cancelable: true });

  // Update status to demonstrate reactivity
  setTimeout(() =>
  {
    buildStatus = 'Complete';
  }, 2000);

  const result2 = await op2.run();

  if (result2.ok)
  {
    const selected: string = result2.value;
    console.log(`\n✅ Selected: ${selected}`);
  }
  else if (result2.failure === 'canceled')
  {
    console.log('\n🚫 Canceled');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Example 3: Menu with chalk styling
  // console.log('Example 3: Menu with custom styling\n');

  const menu3 = Menu.create(
    MenuItem.create('danger' as const)
      .label(chalk.red('[D]') + 'angerous action')
      .help(chalk.dim('⚠️  This cannot be undone!')),
    MenuItem.create('safe' as const)
      .label(chalk.green('[S]') + 'afe action')
      .help(chalk.dim('✓ Reversible operation')),
    MenuItem.create('info' as const)
      .label(chalk.blue('[I]') + 'nfo')
      .help(chalk.dim('View information only')),
  )
    .header(InfoPanel.text(chalk.bgBlue.white.bold(' System Operations ')))
    .footer(InfoPanel.columns(
      chalk.dim('Status: ') + chalk.green('OK'),
      chalk.dim('User: ') + chalk.cyan('admin'),
      chalk.dim('Time: ') + chalk.yellow('14:32'),
    ));

  const op3 = new MenuOp(menu3, { cancelable: true });
  const result3 = await op3.run();

  if (result3.ok)
  {
    const selected: string = result3.value;
    console.log(`\n✅ Selected: ${selected}`);
  }
  else if (result3.failure === 'canceled')
  {
    console.log('\n🚫 Canceled');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Example 4: Demonstrate type safety
  // console.log('Example 4: Type-safe menu (compile-time safety)\n');

  const menu4 = Menu.create(
    MenuItem.create('option1' as const).label('[1] First option'),
    MenuItem.create('option2' as const).label('[2] Second option'),
    MenuItem.create('option3' as const).label('[3] Third option'),
  );

  const op4 = new MenuOp(menu4);
  const result4 = await op4.run();

  if (result4.ok)
  {
    // TypeScript knows result4.value is 'option1' | 'option2' | 'option3'
    switch (result4.value)
    {
      case 'option1':
        console.log('\n✅ You selected option 1');
        break;
      case 'option2':
        console.log('\n✅ You selected option 2');
        break;
      case 'option3':
        console.log('\n✅ You selected option 3');
        break;
      // TypeScript will error if we forget a case or use invalid value
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('All examples complete!');
  console.log('='.repeat(80));
}
