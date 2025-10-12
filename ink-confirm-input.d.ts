/**
 * Type declarations for ink-confirm-input
 *
 * This library doesn't ship with types, so we declare them here.
 */
declare module 'ink-confirm-input'
{
  import type { FC } from 'react';

  export interface ConfirmInputProps
  {
    value?: string;
    placeholder?: string;
    onChange?: (value: string) => void;
    onSubmit?: (value: boolean) => void;
  }

  const ConfirmInput: FC<ConfirmInputProps>;
  export default ConfirmInput;
}
