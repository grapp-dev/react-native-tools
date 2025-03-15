import { Prompt } from '@effect/cli';
import { checkbox } from '@inquirer/prompts';

import color from 'cli-color';
import { Array, Data, Effect, pipe } from 'effect';

class PromptError extends Data.TaggedError('PromptError')<{ message: string; cause: unknown }> {}
class PromptValidationError extends Data.TaggedError('PromptValidationError') {}
class PromptExitError extends Data.TaggedError('PromptExitError') {}

export class PromptService extends Effect.Service<PromptService>()('Prompt', {
  effect: Effect.gen(function* (_) {
    const multiSelect = <T>(
      options: Prompt.Prompt.SelectOptions<T> & Prompt.Prompt.MultiSelectOptions,
    ) => {
      const { message, choices, maxPerPage = 20 } = options;

      return pipe(
        Effect.tryPromise({
          try: _signal => {
            return checkbox<T>({
              message,
              loop: false,
              theme: {
                icon: {
                  cursor: '→',
                  checked: color.greenBright(' +'),
                  unchecked: color.white(' -'),
                },
                prefix: color.cyan('[?]'),
                helpMode: 'always',
              },
              shortcuts: {
                all: 'a',
                invert: 'i',
              },
              choices: Array.map(choices, choice => {
                return {
                  name: choice.title,
                  value: choice.value,
                };
              }),
              pageSize: maxPerPage,
            });
          },
          catch: cause => {
            if (cause instanceof Error && cause.name === 'ValidationError') {
              return new PromptValidationError();
            }

            if (cause instanceof Error && cause.name === 'ExitPromptError') {
              return new PromptExitError();
            }

            return new PromptError({
              message: '',
              cause,
            });
          },
        }),
        Effect.catchTags({
          PromptExitError: _error => {
            return Effect.succeed<T[]>([]);
          },
        }),
      );
    };

    return {
      multiSelect,
    };
  }),
  dependencies: [],
}) {
  static layer = PromptService.Default;
}
