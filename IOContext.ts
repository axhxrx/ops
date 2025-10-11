import type { OpRunnerArgs } from './args';
import { RecordableStdin } from './RecordableStdin';
import { TeeStream } from './TeeStream';

/**
 IO Context provides stdin/stdout streams for ops

 Allows switching between interactive, record, and replay modes
 */
export type IOContext = {
  stdin: NodeJS.ReadStream | RecordableStdin;
  stdout: NodeJS.WriteStream | NodeJS.WritableStream;
  mode: 'interactive' | 'record' | 'replay';
  // Optional: Keep reference to RecordableStdin for saving later
  recordableStdin?: RecordableStdin;
};

/**
 Create an IOContext from OpRunner configuration

 Handles:
 - Logging: If config.logFile is set, creates TeeStream to write to both console and file
 - Recording: If mode is 'record', creates RecordableStdin to capture input
 - TODO: Replay mode (ReplayableStdin)

 @param config - OpRunner configuration from arg parsing
 @returns IOContext with appropriate streams
 */
export function createIOContext(config: OpRunnerArgs): IOContext
{
  // Create stdin - use RecordableStdin if recording
  let stdin: NodeJS.ReadStream | RecordableStdin = process.stdin;
  let recordableStdin: RecordableStdin | undefined;

  if (config.mode === 'record')
  {
    recordableStdin = new RecordableStdin();
    // RecordableStdin is compatible with ReadStream (implements EventEmitter interface)
    stdin = recordableStdin;
    console.log(`[IOContext] 🔴 Recording input to: ${config.sessionFile}\n`);
  }

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
    stdin,
    stdout,
    mode: config.mode,
    recordableStdin,
  };
}
