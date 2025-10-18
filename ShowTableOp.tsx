#!/usr/bin/env bun

import React from 'react';
import { render } from 'ink';
import type { IOContext } from './IOContext';
import { Op } from './Op';
import { TableView } from './ShowTableOp.ui';

/**
 Table column configuration
 */
export type TableColumn = {
  /**
   Column key matching a property in the row data
   */
  key: string;

  /**
   Display label for the column header
   */
  label: string;

  /**
   Fixed width in characters (optional, auto-sizes if not specified)
   */
  width?: number;

  /**
   Text alignment within the column
   */
  align?: 'left' | 'right' | 'center';
};

/**
 Table row with data and optional metadata
 */
export type TableRow<T = Record<string, string | number | boolean>> = {
  /**
   Row data - keys should match column keys
   */
  data: T;

  /**
   Optional help text to display when this row is highlighted
   */
  helpText?: string;

  /**
   Whether this row can be selected (default: true)
   */
  selectable?: boolean;

  /**
   Optional metadata for styling
   */
  metadata?: {
    /**
     Text color for this row
     */
    color?: string;

    /**
     Whether this row is disabled/dimmed
     */
    dimmed?: boolean;
  };
};

/**
 Complete table data structure
 */
export type TableData<T = Record<string, string | number | boolean>> = {
  /**
   Column definitions
   */
  columns: TableColumn[];

  /**
   Table rows
   */
  rows: TableRow<T>[];
};

/**
 Function that provides table data (for dynamic/polling scenarios)
 */
export type TableDataProvider<T = Record<string, string | number | boolean>> =
  () => TableData<T> | Promise<TableData<T>>;

/**
 Table display/interaction mode
 */
export type TableMode = 'display' | 'select-row' | 'select-multi';

/**
 Options for ShowTableOp
 */
export type ShowTableOpOptions<T = Record<string, string | number | boolean>> = {
  /**
   Table interaction mode (default: 'display')
   */
  mode?: TableMode;

  /**
   Allow user to press Escape to cancel (only applies to select modes)
   */
  cancelable?: boolean;

  /**
   Poll interval in milliseconds for dynamic data (only used if dataProvider is a function)
   */
  pollIntervalMs?: number;

  /**
   Table title displayed above the table
   */
  title?: string;

  /**
   Initial data or data provider function
   */
  dataProvider: TableData<T> | TableDataProvider<T>;

  /**
   Error/validation message to display prominently in the UI
   */
  errorMessage?: string | null;

  /**
   Fill terminal height by adding spacer (naturally pushes old content up, default: true)
   */
  fillHeight?: boolean;
};

/**
 Display an interactive table with optional row selection

 Supports three modes:
 1. **display** - Read-only table display
 2. **select-row** - Single row selection with arrow keys + Enter
 3. **select-multi** - Multiple row selection with Space to toggle, Enter to confirm

 Can display static data or dynamic data via a polling callback.

 Success value:
 - `display` mode: void
 - `select-row` mode: The selected row
 - `select-multi` mode: Array of selected rows

 Failure: 'canceled' | 'unknownError'

 @example Display mode with static data
 ```typescript
 const data: TableData = {
   columns: [
     { key: 'name', label: 'Name', width: 20 },
     { key: 'score', label: 'Score', width: 10, align: 'right' }
   ],
   rows: [
     { data: { name: 'Alice', score: 95 } },
     { data: { name: 'Bob', score: 87 } }
   ]
 };
 const op = new ShowTableOp({ mode: 'display', dataProvider: data });
 await op.run();
 ```

 @example Select mode with help text
 ```typescript
 const data: TableData = {
   columns: [
     { key: 'option', label: 'Option' },
     { key: 'description', label: 'Description' }
   ],
   rows: [
     {
       data: { option: 'Start', description: 'Begin the game' },
       helpText: 'Press Enter to start a new game'
     },
     {
       data: { option: 'Quit', description: 'Exit' },
       helpText: 'Press Enter to quit the application'
     }
   ]
 };
 const op = new ShowTableOp({ mode: 'select-row', dataProvider: data, cancelable: true });
 const result = await op.run();
 if (result.ok) {
   console.log('Selected:', result.value.data.option);
 }
 ```

 @example Dynamic data with polling
 ```typescript
 let counter = 0;
 const dataProvider = () => ({
   columns: [{ key: 'time', label: 'Current Time' }],
   rows: [{ data: { time: new Date().toLocaleTimeString() } }]
 });
 const op = new ShowTableOp({
   mode: 'display',
   dataProvider,
   pollIntervalMs: 1000
 });
 await op.run();
 ```

 @example Multi-select mode
 ```typescript
 const data: TableData = {
   columns: [{ key: 'item', label: 'Item' }],
   rows: [
     { data: { item: 'Apple' } },
     { data: { item: 'Banana' } },
     { data: { item: 'Cherry' } }
   ]
 };
 const op = new ShowTableOp({ mode: 'select-multi', dataProvider: data });
 const result = await op.run();
 if (result.ok) {
   console.log('Selected items:', result.value.map(r => r.data.item));
 }
 ```
 */
export class ShowTableOp<T = Record<string, string | number | boolean>> extends Op
{
  name = 'ShowTableOp';

  constructor(private options: ShowTableOpOptions<T>)
  {
    super();
  }

  async run(io?: IOContext)
  {
    const ioContext = this.getIO(io);
    const mode = this.options.mode ?? 'display';

    type SingleRowResult = TableRow<T>;
    type MultiRowResult = TableRow<T>[];

    let result: SingleRowResult | MultiRowResult | 'canceled' | 'display-closed' | null = null;

    const { unmount, waitUntilExit } = render(
      <TableView
        options={this.options as ShowTableOpOptions}
        errorMessage={this.options.errorMessage}
        logger={ioContext.logger}
        onSelect={mode === 'select-row'
          ? (row: TableRow) =>
          {
            this.log(io, `Selected row: ${JSON.stringify(row.data)}`);
            result = row as unknown as SingleRowResult;
            unmount();
          }
          : undefined}
        onSelectMulti={mode === 'select-multi'
          ? (rows: TableRow[]) =>
          {
            this.log(io, `Selected ${rows.length} rows`);
            result = rows as unknown as MultiRowResult;
            unmount();
          }
          : undefined}
        onCancel={this.options.cancelable && mode !== 'display'
          ? () =>
          {
            this.log(io, 'Canceled');
            result = 'canceled';
            unmount();
          }
          : undefined}
        onExit={mode === 'display'
          ? () =>
          {
            this.log(io, 'Table display closed');
            result = 'display-closed';
            unmount();
          }
          : undefined}
      />,
      // exitOnCtrlC defaults to true - let Ink handle Ctrl-C and terminate
    );

    await waitUntilExit();

    // Handle outcomes based on mode
    if (result === null)
    {
      return this.failWithUnknownError('No result from table view');
    }

    if (result === 'canceled')
    {
      return this.cancel();
    }

    if (result === 'display-closed')
    {
      return this.succeed(undefined as unknown as T);
    }

    // Type-safe result handling
    if (mode === 'select-row')
    {
      return this.succeed(result as SingleRowResult as unknown as T);
    }

    if (mode === 'select-multi')
    {
      return this.succeed(result as MultiRowResult as unknown as T);
    }

    // Display mode
    return this.succeed(undefined as unknown as T);
  }
}

if (import.meta.main)
{
  console.log('🎬 ShowTableOp Demo\n');

  // Demo 1: Display mode with static data
  console.log('Example 1: Display mode - Game leaderboard (press any key to close)\n');
  const leaderboardData: TableData = {
    columns: [
      { key: 'rank', label: 'Rank', width: 6, align: 'right' },
      { key: 'player', label: 'Player', width: 20 },
      { key: 'score', label: 'Score', width: 10, align: 'right' },
      { key: 'level', label: 'Level', width: 8, align: 'center' },
    ],
    rows: [
      { data: { rank: 1, player: 'Alice', score: 95420, level: 42 } },
      { data: { rank: 2, player: 'Bob', score: 87650, level: 38 } },
      { data: { rank: 3, player: 'Charlie', score: 76890, level: 35 } },
      { data: { rank: 4, player: 'Diana', score: 65230, level: 31 } },
      { data: { rank: 5, player: 'Eve', score: 54120, level: 28 } },
    ],
  };

  const displayOp = new ShowTableOp({
    mode: 'display',
    dataProvider: leaderboardData,
    title: '🏆 Game Leaderboard',
  });

  const displayResult = await displayOp.run();
  if (displayResult.ok)
  {
    console.log('✅ Display mode completed\n');
  }
  else
  {
    console.log('❌ Error:', displayResult.failure, displayResult.debugData, '\n');
  }

  console.log('---\n');

  // Demo 2: Select-row mode with help text
  console.log('Example 2: Select-row mode - Choose an action (with help text)\n');
  const menuData: TableData = {
    columns: [
      { key: 'option', label: 'Option', width: 20 },
      { key: 'description', label: 'Description', width: 40 },
    ],
    rows: [
      {
        data: { option: 'Start Game', description: 'Begin a new game session' },
        helpText: 'This will start a new game from level 1. Your previous progress will be saved.',
      },
      {
        data: { option: 'Load Game', description: 'Continue from saved game' },
        helpText: 'Load your last saved game. You can have up to 3 save slots.',
      },
      {
        data: { option: 'Settings', description: 'Adjust game settings' },
        helpText: 'Configure graphics, audio, controls, and gameplay options.',
      },
      {
        data: { option: 'Quit', description: 'Exit the application' },
        helpText: 'Exit the game. Your progress will be automatically saved.',
      },
    ],
  };

  const selectOp = new ShowTableOp({
    mode: 'select-row',
    dataProvider: menuData,
    cancelable: true,
    title: '📋 Main Menu',
  });

  const selectResult = await selectOp.run();
  if (selectResult.ok)
  {
    const selected = selectResult.value as unknown as TableRow;
    console.log('✅ Selected:', selected.data.option, '\n');
  }
  else if (selectResult.failure === 'canceled')
  {
    console.log('🚫 Selection canceled\n');
  }
  else
  {
    console.log('❌ Error:', selectResult.failure, selectResult.debugData, '\n');
  }

  console.log('---\n');

  // Demo 3: Multi-select mode
  console.log('Example 3: Multi-select mode - Choose multiple items (Space to toggle, Enter to confirm)\n');
  const itemsData: TableData = {
    columns: [
      { key: 'item', label: 'Item', width: 20 },
      { key: 'quantity', label: 'Qty', width: 8, align: 'right' },
      { key: 'price', label: 'Price', width: 10, align: 'right' },
    ],
    rows: [
      {
        data: { item: 'Apple', quantity: 10, price: '$2.50' },
        helpText: 'Fresh red apples from local orchards',
      },
      {
        data: { item: 'Banana', quantity: 6, price: '$1.99' },
        helpText: 'Organic bananas, perfect for smoothies',
      },
      {
        data: { item: 'Cherry', quantity: 20, price: '$5.00' },
        helpText: 'Sweet cherries in season',
      },
      {
        data: { item: 'Date', quantity: 12, price: '$3.50' },
        helpText: 'Medjool dates, naturally sweet',
      },
    ],
  };

  const multiSelectOp = new ShowTableOp({
    mode: 'select-multi',
    dataProvider: itemsData,
    cancelable: true,
    title: '🛒 Shopping Cart',
  });

  const multiResult = await multiSelectOp.run();
  if (multiResult.ok)
  {
    const selected = multiResult.value as unknown as TableRow[];
    console.log('✅ Selected items:', selected.map((r) => r.data.item).join(', '), '\n');
  }
  else if (multiResult.failure === 'canceled')
  {
    console.log('🚫 Selection canceled\n');
  }
  else
  {
    console.log('❌ Error:', multiResult.failure, multiResult.debugData, '\n');
  }

  console.log('---\n');

  // Demo 4: Dynamic data with polling
  console.log('Example 4: Dynamic data - Live clock (updates every second, press any key to close)\n');
  let updateCount = 0;
  const clockDataProvider: TableDataProvider = () =>
  {
    updateCount++;
    return {
      columns: [
        { key: 'label', label: 'Info', width: 15 },
        { key: 'value', label: 'Value', width: 30 },
      ],
      rows: [
        { data: { label: 'Current Time', value: new Date().toLocaleTimeString() } },
        { data: { label: 'Current Date', value: new Date().toLocaleDateString() } },
        { data: { label: 'Updates', value: updateCount.toString() } },
      ],
    };
  };

  const dynamicOp = new ShowTableOp({
    mode: 'display',
    dataProvider: clockDataProvider,
    pollIntervalMs: 1000,
    title: '⏰ Live Clock',
  });

  const dynamicResult = await dynamicOp.run();
  if (dynamicResult.ok)
  {
    console.log('✅ Dynamic display completed\n');
  }
  else
  {
    console.log('❌ Error:', dynamicResult.failure, dynamicResult.debugData, '\n');
  }

  console.log('🎉 All demos complete!');
}
