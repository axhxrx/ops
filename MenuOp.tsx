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
      {
        stdin: ioContext.stdin as any,
        stdout: ioContext.stdout as any,
      },
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

  // Parse args: `./MenuOp.tsx last` or `./MenuOp.tsx 3` or `./MenuOp.tsx 1 2 4`
  const args = process.argv.slice(2);
  let examplestoRun: number[] = [];

  if (args.length === 0)
  {
    // No args - run all examples
    examplestoRun = [1, 2, 3, 4, 5];
  }
  else
  {
    for (const arg of args)
    {
      if (arg === 'last')
      {
        examplestoRun.push(5);
      }
      else
      {
        const num = parseInt(arg, 10);
        if (!isNaN(num) && num >= 1 && num <= 5)
        {
          examplestoRun.push(num);
        }
      }
    }
  }

  const shouldRun = (exampleNum: number) => examplestoRun.includes(exampleNum);

  // Don't use console.log before Ink renders - it confuses the layout!
  // console.log('='.repeat(80));
  // console.log('MenuOp Examples - Kick-Ass Menus');
  // console.log('='.repeat(80));
  // console.log();

  // Example 1: Simple menu matching the user's first mockup
  // console.log('Example 1: Manifest loader menu\n');

  if (shouldRun(1))
  {

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
  }

  // Example 2: Menu with multi-line header and reactive content
  // console.log('Example 2: Menu with detailed header and reactive status\n');

  if (shouldRun(2))
  {

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
  }

  // Example 3: Menu with chalk styling
  // console.log('Example 3: Menu with custom styling\n');

  if (shouldRun(3))
  {

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
  }

  // Example 4: Demonstrate type safety
  // console.log('Example 4: Type-safe menu (compile-time safety)\n');

  if (shouldRun(4))
  {

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

  console.log('\n' + '='.repeat(80) + '\n');
  }

  // Example 5: Split-pane mode with details panel
  // console.log('Example 5: Split-pane mode with details\n');

  if (shouldRun(5))
  {

  // Create a simple file logger for debugging
  // const fs = await import('fs');
  // const logFile = '/tmp/menuop-debug.log';
  // const fileLogger = {
  //   log: (message: string) =>
  //   {
  //     fs.appendFileSync(logFile, message + '\n');
  //   },
  // };
  // // Clear log file
  // fs.writeFileSync(logFile, '=== MenuOp Debug Log ===\n');

  const menu5 = Menu.create(
    MenuItem.create('vegetables' as const)
      .label('[V]egetables')
      .help('Configure vegetable settings')
      .details([
        ['Setting', 'Value'],
        ['Enabled', 'Yes'],
        ['Count', '42'],
        ['Quality', 'Premium'],
        ['Source', 'Local Farm'],
      ]),
    MenuItem.create('fruits' as const)
      .label('[F]ruits')
      .help('Configure fruit preferences')
      .details('Fresh fruits are sourced from local orchards. All items are organic and pesticide-free. Available year-round with seasonal varieties.'),
    MenuItem.create('grains' as const)
      .label('[G]rains')
      .help('Grain and cereal options')
      .details(
        InfoPanel.lines(
          '🌾 Grain Settings',
          '',
          ['Type', 'Whole Grain'],
          ['Gluten-free', 'Available'],
          ['Organic', 'Yes'],
        ),
      ),
    MenuItem.create('dairy' as const)
      .label('[D]airy')
      .help('Dairy products and alternatives')
      .details(() =>
        InfoPanel.lines(
          '🥛 Dairy Options',
          '',
          `Updated: ${new Date().toLocaleTimeString()}`,
          '',
          ['Milk', 'Whole, 2%, Skim'],
          ['Cheese', 'Variety Pack'],
          ['Yogurt', 'Greek, Regular'],
        )),
  )
    .header(InfoPanel.text('Food Category Settings'))
    .footer(InfoPanel.columns('Split-pane demo', 'Arrow keys to navigate', 'Esc to cancel'))
    .detailsMinWidth(40); // Details pane gets at least 40% width

  const op5 = new MenuOp(menu5, { cancelable: true });
  const result5 = await op5.run(/* { logger: fileLogger } */);

  if (result5.ok)
  {
    const selected: string = result5.value;
    console.log(`\n✅ Selected: ${selected}`);
  }
  else if (result5.failure === 'canceled')
  {
    console.log('\n🚫 Canceled');
  }

  console.log('\n' + '='.repeat(80) + '\n');
  }

  // Final summary
  console.log('All examples complete!');
  console.log('='.repeat(80));
}
