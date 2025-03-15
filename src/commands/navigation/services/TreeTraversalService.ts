import { Array, Effect, Match, pipe, Predicate, Record, Schema } from 'effect';

import { JsonnetService } from '../../../services';
import { Expression, Group, Navigator, Parent, Screen, Tree } from '../data';

type Children = ReadonlyArray<Group | Screen | Navigator>;

type ProcessOptions = {
  readonly element: typeof Navigator.Encoded | typeof Group.Encoded;
  readonly parent?: typeof Parent.Both.Encoded;
  readonly tree: typeof Tree.Encoded;
};

type Unpack<T> = T extends Effect.Effect<infer K, unknown, unknown> ? K : never;

export type TreeTraversalData = Unpack<ReturnType<TreeTraversalService['from']>>;

export class TreeTraversalService extends Effect.Service<TreeTraversalService>()('TreeTraversal', {
  effect: Effect.gen(function* (_) {
    const Jsonnet = yield* JsonnetService;

    const decode = Schema.decodeUnknown(Tree);

    const process = (options: ProcessOptions): typeof Navigator.Encoded | typeof Group.Encoded => {
      const { element, tree, parent } = options;
      const { config } = tree;

      const children = Array.map(
        element.children,
        Match.type<typeof Navigator.Encoded | typeof Group.Encoded | typeof Screen.Encoded>().pipe(
          Match.tag('Navigator', data => {
            return process({
              element: {
                ...data,
                config,
              },
              parent: {
                _tag: 'Navigator',
                name: data.name,
                parent: parent as typeof Parent.Navigator.Encoded,
                reference: false,
                root: data.root,
              },
              tree,
            });
          }),
          Match.tag('Group', data => {
            const reference = Array.some(tree.groups ?? [], group => {
              return group.name === data.name;
            });

            return process({
              element: {
                ...data,
                config,
              },
              parent: {
                _tag: 'Group',
                name: data.name,
                reference,
                parent: parent as typeof Parent.Navigator.Encoded,
              },
              tree,
            });
          }),
          Match.tag('Screen', data => {
            return {
              ...data,
              config,
              parent: parent as NonNullable<typeof Parent.Both.Encoded>,
            };
          }),
          Match.exhaustive,
        ),
      );

      // @ts-expect-error: ignore
      return {
        ...element,
        parent: parent?.parent,
        config,
        children,
      };
    };

    const flattenNavigators = (children: Children): Array<typeof Navigator.Type> => {
      return Array.reduce(children, [] as Array<typeof Navigator.Type>, (acc, child) => {
        if (child._tag === 'Navigator') {
          return pipe(
            acc,
            Array.append(child),
            Array.prependAll(flattenNavigators(child.children)),
          );
        }

        return acc;
      });
    };

    const flattenScreens = (children: Children): Array<typeof Screen.Type> => {
      return pipe(
        children,
        Array.reduce([] as Array<typeof Screen.Type>, (acc, child) => {
          if (child._tag === 'Screen') {
            return Array.append(acc, child);
          }

          if (child.children) {
            return Array.appendAll(acc, flattenScreens(child.children));
          }

          return acc;
        }),
        Array.dedupeWith((screen1, screen2) => {
          return screen1.name === screen2.name && screen1.parent.name === screen2.parent.name;
        }),
      );
    };

    const flattenExpressions = (data: unknown): Array<typeof Expression.Type> => {
      const traverse = (
        obj: unknown,
        expressions: Array<typeof Expression.Type> = [],
      ): Array<typeof Expression.Type> => {
        return Match.value(obj).pipe(
          Match.when(
            (value: unknown): value is typeof Expression.Type => {
              return Predicate.isObject(value) && '_tag' in value && value._tag === 'Expression';
            },
            value => {
              expressions.push(value);
              return expressions;
            },
          ),
          Match.when(Array.isArray, arr => {
            Array.forEach(arr, element => {
              traverse(element, expressions);
            });

            return expressions;
          }),
          Match.when(Predicate.isObject, obj => {
            Array.forEach(Record.values(obj), value => {
              traverse(value, expressions);
            });

            return expressions;
          }),
          Match.orElse(_ => {
            return expressions;
          }),
        );
      };

      return traverse(data);
    };

    const from = (path: string) => {
      return Effect.gen(function* (_) {
        const json = yield* Jsonnet.read<typeof Tree.Encoded>(path);

        const [treeNavigators, treeGroups] = Array.map(
          [json.navigators, json.groups ?? []],
          Array.map(element => {
            const parent =
              element._tag === 'Group'
                ? {
                    _tag: element._tag,
                    name: element.name,
                    reference: true,
                  }
                : {
                    _tag: element._tag,
                    name: element.name,
                    reference: false,
                    root: element.root,
                  };

            return process({
              element,
              tree: json,
              parent,
            });
          }),
        );

        // console.log(JSON.stringify(treeNavigators, null, 2));

        const tree = yield* decode({
          config: json.config,
          groups: treeGroups,
          navigators: treeNavigators,
        });

        const expressions = flattenExpressions(tree.navigators);
        const navigators = flattenNavigators(tree.navigators);
        const screens = flattenScreens(tree.navigators);

        return {
          tree,
          expressions,
          navigators,
          screens,
        };
      });
    };

    return {
      from,
    };
  }),
  dependencies: [],
}) {
  static layer = TreeTraversalService.Default;
}
