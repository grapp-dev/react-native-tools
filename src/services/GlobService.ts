import { Data, Effect } from 'effect';
import { glob } from 'glob';

export class GlobError extends Data.TaggedError('GlobError')<{ message: string; cause: unknown }> {}

export class GlobService extends Effect.Service<GlobService>()('Glob', {
  effect: Effect.gen(function* (_) {
    const find = (pattern: string) => {
      return Effect.tryPromise({
        try: () => {
          return glob(pattern, {
            ignore: ['node_modules/**', 'android/**', 'ios/**'],
            absolute: true,
          });
        },
        catch: cause => {
          return new GlobError({
            message: 'Glob issue',
            cause,
          });
        },
      });
    };

    return {
      find,
    };
  }),
  dependencies: [],
}) {
  static layer = GlobService.Default;
}
