import type { Op } from './Op';

/**
 A success outcome, containing a value.
 */
export interface Success<T>
{
  ok: true;
  value: T;
}

/**
 A failure outcome, whose `failure` property indicates the type of failure.
 */
export interface Failure<T>
{
  ok: false;
  failure: T;
  debugData?: string;
}

/*
 The `Outcome` type represents the outcome of an op. An op is the fundamental unit of work, and it can either succeed, or fail.

 If the op succeeds, the `Outcome` is a `Success`, which contains the value of the op.

 If the op fails, the `Outcome` is a `Failure`, which indicates how it failed. This library is designed so that the failures can be strongly-typed and handled exhaustively.
 */
export type Outcome<SuccessT, FailureT> =
  | Success<SuccessT>
  | Failure<FailureT>;

/**
 Extract the Outcome type from an Op instance

 @example
 type MyOutcome = OutcomeOf<typeof myOp>
 */
export type OutcomeOf<T extends Op> = Awaited<ReturnType<T['run']>>;

/**
 Handler function that receives a child Op's outcome and decides what to do

 Return values:
 - true: Re-run the parent Op
 - false: Normal completion (pop both parent and child)
 - Op: Replace child with the returned Op (keep parent waiting)

 @example
 ```typescript
 // Re-run parent on cancel
 (outcome) => !outcome.ok && outcome.failure === 'canceled'

 // Re-run parent on any failure
 (outcome) => !outcome.ok

 // Re-run parent on success
 (outcome) => outcome.ok

 // Route to different op based on outcome
 (outcome) => {
   if (!outcome.ok) return true; // re-run on failure
   if (outcome.value === 'A') return new OpA();
   return new OpB();
 }
 ```
 */
export type OutcomeHandler<OpT extends Op> = (outcome: OutcomeOf<OpT>) => boolean | Op;

/**
 Wrapper that pairs an Op with an outcome handler

 When a parent Op returns this type, OpRunner will:
 1. PUSH the child op (not replace)
 2. Keep the parent on the stack
 3. After child completes, call the handler with child's outcome
 4. Use handler's return value to decide what to do next

 This enables flexible control flow without circular dependencies.
 */
export interface OpWithHandler<OpT extends Op>
{
  op: OpT;
  handler: OutcomeHandler<OpT>;
}
