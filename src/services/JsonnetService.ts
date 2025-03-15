import { Data, Effect, Schema } from 'effect';

import { CommandService } from './CommandService';

export class JsonnetError extends Data.TaggedError('JsonnetError')<{
  message: string;
  cause: unknown;
}> {}

export class JsonnetService extends Effect.Service<JsonnetService>()('Jsonnet', {
  effect: Effect.gen(function* (_) {
    const Command = yield* CommandService;

    const read = <T = unknown>(path: string) => {
      return Effect.gen(function* (_) {
        const stdout = yield* Command.execute('jsonnet', path);
        const decode = Schema.decodeUnknown<T, string, never>(Schema.parseJson(Schema.Any));
        const json = yield* decode(stdout);

        return json;
      });
    };

    return {
      read,
    };
  }),
  dependencies: [CommandService.layer],
}) {
  static layer = JsonnetService.Default;
}
