import type { OpRunnerArgs } from './args';

/**
 IO Context provides stdin/stdout streams for ops

 Allows switching between interactive, record, and replay modes
 */
export type IOContext = {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
  mode: 'interactive' | 'record' | 'replay';
};

/**
 Create an IOContext from OpRunner configuration

 For now, just returns process.stdin/stdout (Phase 2 - no behavior change) Later phases will add RecordableStdin, ReplayableStdin, TeeStream, etc.

 @param config - OpRunner configuration from arg parsing
 @returns IOContext with appropriate streams
 */
export function createIOContext(config: OpRunnerArgs): IOContext
{
  // Phase 2: Just pass through process streams
  // Later we'll switch based on config.mode
  return {
    stdin: process.stdin,
    stdout: process.stdout,
    mode: config.mode,
  };
}
