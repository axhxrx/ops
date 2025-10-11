import type { OpRunnerArgs } from './args';
import { TeeStream } from './TeeStream';

/**
 IO Context provides stdin/stdout streams for ops

 Allows switching between interactive, record, and replay modes
 */
export type IOContext = {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream | NodeJS.WritableStream;
  mode: 'interactive' | 'record' | 'replay';
};

/**
 Create an IOContext from OpRunner configuration

 Handles:
 - Logging: If config.logFile is set, creates TeeStream to write to both console and file
 - TODO: Recording mode (RecordableStdin)
 - TODO: Replay mode (ReplayableStdin)

 @param config - OpRunner configuration from arg parsing
 @returns IOContext with appropriate streams
 */
export function createIOContext(config: OpRunnerArgs): IOContext
{
  // Create stdout - use TeeStream if logging is enabled
  const stdout = config.logFile
    ? new TeeStream(config.logFile)
    : process.stdout;

  // Log configuration info if logging is enabled
  if (config.logFile)
  {
    console.log(`[IOContext] 📝 Logging to: ${config.logFile}\n`);
  }

  return {
    stdin: process.stdin,
    stdout,
    mode: config.mode,
  };
}
