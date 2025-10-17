// Main exports for @axhxrx/ops
import dedent from 'dedent';
/** `ded` is just a re-export of `dedent` from `dedent` (for historical reaso*/
export { dedent as ded };

export { ConfirmOp } from './ConfirmOp';
export { ResultOp, SelectNameOp, WelcomeOp } from './GameOps';
export { InputTextOp } from './InputTextOp';
export type { IOContext } from './IOContext';
export { Op } from './Op';
export { OpRunner } from './OpRunner';
export type { Outcome } from './Outcome';
export { PrintOp } from './PrintOp';
export { SelectFromListOp } from './SelectFromListOp';
