import { Command } from '@effect/cli';
import { NodeContext } from '@effect/platform-node';

import { Effect, Logger, LogLevel, pipe } from 'effect';

import { NavigationCommand } from './commands';
import {
  CommandService,
  FileFormatterService,
  FileSystemService,
  GlobService,
  JsonnetService,
  LoggerService,
  PromptService,
} from './services';

const ProgramCommand = Command.make('grapp-tools', {}, () => {
  return Effect.logInfo('(add description)');
});

const Program = ProgramCommand.pipe(Command.withSubcommands([NavigationCommand]));

const cli = pipe(
  process.argv,
  Command.run(Program, {
    name: 'React Native Tools',
    version: 'v0.1.0',
  }),
  Effect.provide([
    LoggerService.layer,
    NodeContext.layer,
    JsonnetService.layer,
    FileSystemService.layer,
    FileFormatterService.layer,
    GlobService.layer,
    CommandService.layer,
    PromptService.layer,
  ]),
  Logger.withMinimumLogLevel(LogLevel.All),
);

Effect.runPromise(cli);
