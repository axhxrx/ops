import type { Op } from 'Op';

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
