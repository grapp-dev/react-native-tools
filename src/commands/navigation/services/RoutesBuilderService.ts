import * as Platform from '@effect/platform';

import { Array, Effect, pipe } from 'effect';

import { TreeTraversalService } from './TreeTraversalService';

import { FileSystemService } from '../../../services';
import { Navigator, Screen } from '../data';

export class RoutesBuilderService extends Effect.Service<RoutesBuilderService>()('RoutesBuilder', {
  accessors: true,
  effect: Effect.gen(function* (_) {
    const TreeTraversal = yield* TreeTraversalService;
    const FileSystem = yield* FileSystemService;
    const Path = yield* Platform.Path.Path;

    const makeNavigatorRoutes = (navigators: ReadonlyArray<typeof Navigator.Type>) => {
      return pipe(
        navigators,
        Array.map(navigator => {
          return navigator.toRouteLiteralVariable();
        }),
        Array.flatten,
      );
    };

    const makeScreenRoutes = (screens: ReadonlyArray<typeof Screen.Type>) => {
      return Array.map(screens, screen => {
        return screen.toRouteLiteralVariable();
      });
    };

    const makeRouteExpressions = (screens: ReadonlyArray<typeof Screen.Type>) => {
      return Array.map(screens, screen => {
        return screen.toRouteExpression();
      });
    };

    const build = (path: string) => {
      return Effect.gen(function* (_) {
        const tree = yield* TreeTraversal.from(path);

        const navigatorRoutes = makeNavigatorRoutes(tree.navigators);
        const screenRoutes = makeScreenRoutes(tree.screens);
        const routeExpressions = makeRouteExpressions(tree.screens);

        const declarations = pipe(
          navigatorRoutes,
          Array.appendAll(screenRoutes),
          Array.appendAll(routeExpressions),
        );

        const dirname = Path.dirname(path);

        yield* FileSystem.writeFileFromDeclarations(
          Path.resolve(dirname, 'routes.gen.ts'),
          declarations,
          source => {
            return source.replace(/\n\n(\s+params: {)/g, '\n$1');
          },
        );

        yield* Effect.logInfo('RoutesBuilder: done');
      });
    };

    return {
      build,
    };
  }),
  dependencies: [TreeTraversalService.layer, FileSystemService.layer],
}) {
  static layer = RoutesBuilderService.Default;
}
