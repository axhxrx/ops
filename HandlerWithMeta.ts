import type { OutcomeHandler } from './Outcome';
import type { Op } from './Op';

/**
 * Wrapper for OutcomeHandler that includes metadata for logging
 */
export interface HandlerWithMeta
{
  handler: OutcomeHandler<Op>;
  parentName: string; // Name of the op that created this handler
}

/**
 * Type guard to check if a value is a HandlerWithMeta
 */
export function isHandler(value: unknown): value is HandlerWithMeta
{
  return (
    typeof value === 'object'
    && value !== null
    && 'handler' in value
    && typeof (value as Record<string, unknown>).handler === 'function'
    && 'parentName' in value
    && typeof (value as Record<string, unknown>).parentName === 'string'
  );
}
