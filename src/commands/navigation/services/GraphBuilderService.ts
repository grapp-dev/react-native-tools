import * as Platform from '@effect/platform';

import { Effect } from 'effect';

import { TreeTraversalService } from './TreeTraversalService';

import { CommandService, FileSystemService } from '../../../services';
import { Graph } from '../data';

export class GraphBuilderService extends Effect.Service<GraphBuilderService>()('GraphBuilder', {
  accessors: true,
  effect: Effect.gen(function* (_) {
    const TreeTraversal = yield* TreeTraversalService;
    const FileSystem = yield* FileSystemService;
    const Path = yield* Platform.Path.Path;
    const Command = yield* CommandService;

    const build = (path: string) => {
      return Effect.gen(function* (_) {
        const tree = yield* TreeTraversal.from(path);
        const content = Graph.fromTree(tree);
        const dirname = Path.dirname(path);

        const input = Path.resolve(dirname, 'navigation.gen.dot');
        const output = Path.resolve(dirname, 'navigation.gen.svg');

        yield* FileSystem.writeFileFromString(input, content);
        yield* Command.execute('dot', '-Tsvg', input, '-o', output);

        yield* Effect.logInfo(
          `GraphBuilder: done, file exported to ${Path.relative(process.cwd(), output)}`,
        );
      });
    };

    return {
      build,
    };
  }),
  dependencies: [TreeTraversalService.layer, FileSystemService.layer],
}) {
  static layer = GraphBuilderService.Default;
}
