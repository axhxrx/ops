// Main exports for @axhxrx/ops

// ============================================================================
// Core framework (re-exported from @axhxrx/op)
// ============================================================================

export { Op } from '@axhxrx/op';
export { OpRunner } from '@axhxrx/op';
export * from './Outcome.ts';

export type { IOContext } from '@axhxrx/op';
export { createIOContext } from '@axhxrx/op';

export { createDefaultLogger, Logger } from '@axhxrx/op';
export { isOp } from '@axhxrx/op';
export { isHandler } from '@axhxrx/op';
export type { HandlerWithMeta } from '@axhxrx/op';

export { parseOpRunnerArgs } from '@axhxrx/op';
export type { OpRunnerArgs } from '@axhxrx/op';

export { RecordableStdin } from '@axhxrx/op';
export type { InputEvent, Session } from '@axhxrx/op';
export { ReplayableStdin } from '@axhxrx/op';

export { TeeStream } from '@axhxrx/op';
export type { TeeStreamOptions } from '@axhxrx/op';
export { hasAnsi, stripAnsi, stripAnsiFromLines } from '@axhxrx/op';

export { PrintOp } from '@axhxrx/op';
export type { PrintOpOptions } from '@axhxrx/op';

export { main } from '@axhxrx/op';
export { init } from '@axhxrx/op';
export type { InitResult } from '@axhxrx/op';

// ============================================================================
// Ink/React UI ops (local to @axhxrx/ops)
// ============================================================================

import dedent from 'ts-dedent';
/** `ded` is just a re-export of `ts-dedent` from `dedent` (for historical reasons) */
export { dedent as ded };

export { ConfirmOp } from './ConfirmOp.tsx';
export { ResultOp, SelectNameOp, WelcomeOp } from './GameOps.ts';
export { InputTextOp } from './InputTextOp.tsx';
export { MenuOp } from './MenuOp.tsx';
export { InfoPanel, Menu, MenuItem } from './MenuPrimitives.ts';
export type { DynamicContent, LineContent } from './MenuPrimitives.ts';
export { RenderMarkdownOp } from './RenderMarkdownOp.tsx';
export { SelectFromFilesystemOp } from './SelectFromFilesystemOp.ts';
export type { FileSystemEntry, FileSystemEntryType, FileSystemSelectionMode,
  SelectFromFilesystemOpOptions } from './SelectFromFilesystemOp.ts';
export { SelectFromListOp } from './SelectFromListOp.tsx';
export { ShowTableOp } from './ShowTableOp.tsx';
export type { ShowTableOpOptions, TableColumn, TableData, TableDataProvider, TableMode,
  TableRow } from './ShowTableOp.tsx';
export type { CustomKeyHandler } from './ShowTableOp.ui.tsx';

export { Form, FormItem } from './FormPrimitives.ts';
export type { FieldType, Validator } from './FormPrimitives.ts';
export { ShowFormOp } from './ShowFormOp.tsx';
export type { ShowFormOpFailure, ShowFormOpOptions, ShowFormOpSuccess } from './ShowFormOp.tsx';

if (import.meta.main)
{
  console.log(`
    Hello, this is @axhxrx/ops.

    This library's mod.ts just exports the public API for the library.

    You might be looking for main.ts.
  `);
}
