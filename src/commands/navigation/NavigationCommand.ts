import { Command } from '@effect/cli';

import { Effect, pipe } from 'effect';

import { GenerateCommand } from './commands';

export const NavigationCommand = pipe(
  Command.make('navigation', {}, _config => {
    return Effect.logDebug('(add description)');
  }),
  Command.withSubcommands([GenerateCommand]),
);
