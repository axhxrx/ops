#!/usr/bin/env bun

/**
 Test script for ShowTableOp viewport scrolling

 This creates a table with 100 rows to test:
 - Viewport scrolling (only visible rows rendered)
 - Scroll indicators (▲ above, ▼ below)
 - Auto-scroll when navigating
 - Terminal size detection
 - Minimum terminal size warning

 Try:
 - Resize your terminal to different sizes
 - Use ↑↓ to navigate and watch auto-scroll
 - Use h/e for home/end
 - Use PgUp/PgDn for page jumps
 */

import { ShowTableOp } from './ShowTableOp.tsx';
import type { TableData } from './ShowTableOp.tsx';

console.log('🧪 ShowTableOp Scrolling Test\n');
console.log('Testing viewport scrolling with 100 rows...\n');
console.log('Navigation:');
console.log('  ↑↓: Move up/down (watch the viewport scroll!)');
console.log('  h: Jump to first row');
console.log('  e: Jump to last row');
console.log('  PgUp/PgDn: Jump by page');
console.log("  Look for ▲ and ▼ indicators when there's more content\n");
console.log('---\n');

// Generate 100 rows of test data
const rows = Array.from({ length: 100 }, (_, i) => ({
  data: {
    id: i + 1,
    name: `Item ${String(i + 1).padStart(3, '0')}`,
    category: ['Alpha', 'Beta', 'Gamma', 'Delta'][i % 4] ?? 'Other',
    value: Math.floor(Math.random() * 1000),
    status: ['Active', 'Pending', 'Inactive'][i % 3] ?? 'Unknown',
  },
  helpText: `This is row ${i + 1} of 100.\nUse ↑↓ to navigate.\nNotice how the viewport scrolls automatically!`,
}));

const bigTableData: TableData = {
  columns: [
    { key: 'id', label: 'ID', width: 5, align: 'right' },
    { key: 'name', label: 'Name', width: 15 },
    { key: 'category', label: 'Category', width: 10 },
    { key: 'value', label: 'Value', width: 8, align: 'right' },
    { key: 'status', label: 'Status', width: 10 },
  ],
  rows,
};

const op = new ShowTableOp({
  mode: 'select-row',
  dataProvider: bigTableData,
  cancelable: true,
  title: '📜 Large Table (100 rows) - Test Scrolling',
});

const result = await op.run();

console.log('\n---\n');

if (result.ok)
{
  const selected = result.value as unknown as { data: { id: number; name: string } };
  console.log('✅ Selected:', selected.data.name, `(ID: ${selected.data.id})`);
  console.log(`   You selected row ${selected.data.id} out of 100 total rows!`);
}
else if (result.failure === 'canceled')
{
  console.log('🚫 Selection canceled');
}
else
{
  console.log('❌ Error:', result.failure, result.debugData);
}

console.log('\n🎉 Scrolling test complete!\n');
console.log('Tips:');
console.log('  - Try resizing your terminal while running this');
console.log('  - The viewport should adapt to your terminal size');
console.log("  - If terminal is too small, you'll see a warning message");
