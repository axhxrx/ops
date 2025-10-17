// Main exports for @axhxrx/ops
import dedent from 'ts-dedent';
/** `ded` is just a re-export of `ts-dedent` from `dedent` (for historical reaso*/
export { dedent as ded };

export { ConfirmOp } from './ConfirmOp';
export { ResultOp, SelectNameOp, WelcomeOp } from './GameOps';
export { InputTextOp } from './InputTextOp';
export type { IOContext } from './IOContext';
export { Op } from './Op';
export { OpRunner } from './OpRunner';
export * from './Outcome';
export { PrintOp } from './PrintOp';
export { RenderMarkdownOp } from './RenderMarkdownOp.tsx';
export { SelectFromFilesystemOp } from './SelectFromFilesystemOp';
export type { FileSystemEntry, FileSystemEntryType, FileSystemSelectionMode,
  SelectFromFilesystemOpOptions } from './SelectFromFilesystemOp';
export { SelectFromListOp } from './SelectFromListOp';
export { ShowTableOp } from './ShowTableOp.tsx';
export type { ShowTableOpOptions, TableColumn, TableData, TableDataProvider, TableMode,
  TableRow } from './ShowTableOp.tsx';
