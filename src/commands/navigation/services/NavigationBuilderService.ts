import * as Platform from '@effect/platform';

import { Array, Effect, pipe, Record, Tuple } from 'effect';
import { Option } from 'effect';
import j, { ExportNamedDeclaration, ImportSpecifier, VariableDeclaration } from 'jscodeshift';

import { TreeTraversalData, TreeTraversalService } from './TreeTraversalService';

import { FileSystemService } from '../../../services';
import { Expression, Navigator, Screen } from '../data';

export class NavigationBuilderService extends Effect.Service<NavigationBuilderService>()(
  'NavigationBuilder',
  {
    accessors: true,
    effect: Effect.gen(function* (_) {
      const TreeTraversal = yield* TreeTraversalService;
      const FileSystem = yield* FileSystemService;
      const Path = yield* Platform.Path.Path;

      const makeNavigatorPackageImports = (navigators: ReadonlyArray<typeof Navigator.Type>) => {
        return Array.map(navigators, navigator => {
          const [importSpecifier, importPath] = Navigator.mapType(navigator.type);
          return Tuple.make(importPath, j.importSpecifier(j.identifier(importSpecifier)));
        });
      };
      const makeExternalNavigatorImports = (navigators: ReadonlyArray<typeof Navigator.Type>) => {
        return Array.filterMap(navigators, navigator => {
          return navigator.toExternalImport();
        });
      };

      const makeScreenImports = (screens: ReadonlyArray<typeof Screen.Type>) => {
        return Array.filterMap(screens, screen => {
          return screen.toImportSpecifier();
        });
      };

      const makeExpressionImports = (expressions: ReadonlyArray<typeof Expression.Type>) => {
        return Array.filterMap(expressions, expression => {
          if (expression.use) {
            const [importSpecifier, importPath] = expression.use;
            return Option.some(
              Tuple.make(importPath, j.importSpecifier(j.identifier(importSpecifier))),
            );
          }

          return Option.none();
        });
      };

      const makeImports = (tree: TreeTraversalData) => {
        const { screens, expressions, navigators } = tree;

        const imports = Array.reduce(
          [
            makeNavigatorPackageImports(navigators),
            makeExternalNavigatorImports(navigators),
            makeScreenImports(screens),
            makeExpressionImports(expressions),
          ],
          [] as Array<[importPath: string, importSpecifier: ImportSpecifier]>,
          (acc, tuples) => {
            return Array.appendAll(acc, tuples);
          },
        );

        const requiredImports = [
          j.importDeclaration(
            [j.importNamespaceSpecifier(j.identifier('React'))],
            j.stringLiteral('react'),
          ),
          j.importDeclaration(
            [j.importNamespaceSpecifier(j.identifier('route'))],
            j.stringLiteral('./routes.gen'),
          ),
        ];

        return pipe(
          imports,
          Array.groupBy(Tuple.getFirst),
          Record.toEntries,
          Array.map(([importPath, tuples]) => {
            const importSpecifiers = pipe(
              tuples,
              Array.dedupeWith((tuple1, tuple2) => {
                return Tuple.getSecond(tuple1).name === Tuple.getSecond(tuple2).name;
              }),
              Array.map(Tuple.getSecond),
            );

            return j.importDeclaration(importSpecifiers, j.stringLiteral(importPath));
          }),
          Array.prependAll(requiredImports),
        );
      };

      const makeNavigators = (navigators: ReadonlyArray<typeof Navigator.Type>) => {
        return pipe(
          navigators,
          Array.reduce(
            [] as Array<Option.Option<VariableDeclaration | ExportNamedDeclaration>>,
            (acc, navigator) => {
              return pipe(
                acc,
                Array.prepend(navigator.toVariableDeclaration()),
                Array.append(navigator.toComponentDeclaration()),
              );
            },
          ),
          Array.getSomes,
        );
      };

      const build = (path: string) => {
        return Effect.gen(function* (_) {
          const tree = yield* TreeTraversal.from(path);
          const declarations = Array.appendAll(makeImports(tree), makeNavigators(tree.navigators));
          const dirname = Path.dirname(path);

          yield* FileSystem.writeFileFromDeclarations(
            Path.resolve(dirname, 'navigation.gen.tsx'),
            declarations,
          );

          yield* Effect.logInfo('NavigationBuilder: done');
        });
      };

      return {
        build,
      };
    }),
    dependencies: [TreeTraversalService.layer, FileSystemService.layer],
  },
) {
  static layer = NavigationBuilderService.Default;
}
