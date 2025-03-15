import { Data, Effect, pipe } from 'effect';

export class PrettierError extends Data.TaggedError('PrettierError')<{
  message: string;
  cause: unknown;
}> {}

export class PrettierService extends Effect.Service<PrettierService>()('Prettier', {
  effect: Effect.gen(function* (_) {
    const format = (source: string) => {
      return pipe(
        Effect.tryPromise(async () => {
          const prettier = await import('prettier');
          const config = await prettier.resolveConfig(__dirname);

          return prettier.format(source, config ?? {});
        }),
        Effect.catchTags({
          UnknownException: _error => {
            return Effect.succeed(source);
          },
        }),
      );
    };

    return {
      format,
    };
  }),
  dependencies: [],
}) {
  static layer = PrettierService.Default;
}
