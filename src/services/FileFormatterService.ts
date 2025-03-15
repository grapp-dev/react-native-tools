import { Data, Effect, pipe } from 'effect';

export class FileFormatterError extends Data.TaggedError('FileFormatterError')<{
  message: string;
  cause: unknown;
}> {}

export class FileFormatterService extends Effect.Service<FileFormatterService>()('FileFormatter', {
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
  static layer = FileFormatterService.Default;
}
