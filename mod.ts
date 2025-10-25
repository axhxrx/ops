// Main exports for @axhxrx/ops
import dedent from 'ts-dedent';
/** `ded` is just a re-export of `ts-dedent` from `dedent` (for historical reaso*/
export { dedent as ded };

export { ConfirmOp } from './ConfirmOp.tsx';
export { ResultOp, SelectNameOp, WelcomeOp } from './GameOps.ts';
export { InputTextOp } from './InputTextOp.tsx';
export type { IOContext } from './IOContext.ts';
export { createIOContext } from './IOContext.ts';
export { Op } from './Op.ts';
export { OpRunner } from './OpRunner.ts';
export * from './Outcome.ts';
export { PrintOp } from './PrintOp.ts';
export { RenderMarkdownOp } from './RenderMarkdownOp.tsx';
export { SelectFromFilesystemOp } from './SelectFromFilesystemOp.ts';
export type { FileSystemEntry, FileSystemEntryType, FileSystemSelectionMode,
  SelectFromFilesystemOpOptions } from './SelectFromFilesystemOp.ts';
export { SelectFromListOp } from './SelectFromListOp.tsx';
export { ShowTableOp } from './ShowTableOp.tsx';
export type { ShowTableOpOptions, TableColumn, TableData, TableDataProvider, TableMode,
  TableRow } from './ShowTableOp.tsx';
export { MenuOp } from './MenuOp.tsx';
export { Menu, MenuItem, InfoPanel } from './MenuPrimitives.ts';
export type { DynamicContent, LineContent } from './MenuPrimitives.ts';

// Record/replay support
export { parseOpRunnerArgs } from './args.ts';
export type { OpRunnerArgs } from './args.ts';
export { RecordableStdin } from './RecordableStdin.ts';
export type { InputEvent, Session } from './RecordableStdin.ts';
export { ReplayableStdin } from './ReplayableStdin.ts';

if (import.meta.main) {
  console.log(`
    Hello, this is @axhxrx/ops.

    This library's mod.ts just exports the public API for the library.
    
    You might be looking for main.ts.
  `)
}
