import { Command } from '@effect/platform';
import { PlatformError } from '@effect/platform/Error';

import { Array, Cause, Data, Effect, Match, Option, pipe, Stream, String } from 'effect';

class CommandNotFound extends Data.TaggedError('CommandNotFound')<{
  message: string;
  cause: unknown;
}> {}

class CommandError extends Data.TaggedError('CommandError')<{
  message: string;
}> {}

export class CommandService extends Effect.Service<CommandService>()('Command', {
  effect: Effect.gen(function* (_) {
    const runString = <E, R>(
      stream: Stream.Stream<Uint8Array, E, R>,
    ): Effect.Effect<string, E, R> => {
      return pipe(stream, Stream.decodeText(), Stream.runFold(String.empty, String.concat));
    };

    const execute = (...chunks: Array.NonEmptyArray<string>) => {
      return pipe(
        Effect.gen(function* (_) {
          const command = Command.make(...chunks);

          const [exitCode, stdout, stderr] = yield* pipe(
            Command.start(command),
            Effect.flatMap(process => {
              return Effect.all(
                [process.exitCode, runString(process.stdout), runString(process.stderr)],
                { concurrency: 3 },
              );
            }),
          );

          if (exitCode > 0) {
            yield* Effect.fail(
              new CommandError({
                message: stderr,
              }),
            );
          }

          return stdout;
        }),
        Effect.catchSomeCause(
          Match.type<Cause.Cause<PlatformError | CommandError>>().pipe(
            Match.tag('Die', cause => {
              if (cause.defect instanceof Error) {
                return Option.some(
                  Effect.fail(
                    new CommandNotFound({
                      message: cause.defect.message,
                      cause,
                    }),
                  ),
                );
              }

              return Option.none();
            }),
            Match.orElse(() => {
              return Option.none();
            }),
          ),
        ),
        Effect.scoped,
      );
    };

    return {
      execute,
    };
  }),
  dependencies: [],
}) {
  static layer = CommandService.Default;
}
