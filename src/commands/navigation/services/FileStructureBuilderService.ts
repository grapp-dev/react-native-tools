import * as Platform from '@effect/platform';

import { Array, Effect, Function, Option, pipe, Tuple } from 'effect';

import { FileSystemService } from './FileSystemService';
import { TreeTraversalService } from './TreeTraversalService';

import { PrettierService, PromptService } from '../../../services';

export class FileStructureBuilderService extends Effect.Service<FileStructureBuilderService>()(
  'FileStructureBuilder',
  {
    accessors: true,
    effect: Effect.gen(function* (_) {
      const TreeTraversal = yield* TreeTraversalService;
      const FileSystem = yield* FileSystemService;
      const Prompt = yield* PromptService;
      const Path = yield* Platform.Path.Path;
      const Prettier = yield* PrettierService;

      const build = (path: string) => {
        return pipe(
          Effect.gen(function* (_) {
            const tree = yield* TreeTraversal.from(path);

            const files = yield* pipe(
              tree.screens,
              Array.filterMap(screen => {
                return pipe(
                  screen.toFileTemplate(),
                  Option.map(
                    Array.map(([file, content]) => {
                      return {
                        title: file,
                        value: Tuple.make(Path.resolve(Path.dirname(path), file), content),
                      };
                    }),
                  ),
                );
              }),
              Array.flatten,
              Array.map(file => {
                return Effect.gen(function* (_) {
                  const [path] = file.value;

                  if (yield* FileSystem.exists(path)) {
                    return Option.none();
                  }

                  return Option.some(file);
                });
              }),
              Effect.filterMap(Function.identity),
            );

            const selectedFiles = yield* Prompt.multiSelect({
              message: 'Select files to create',
              choices: files,
            });

            yield* Effect.all(
              Array.map(selectedFiles, selectedFile => {
                return Effect.gen(function* (_) {
                  const [path, source] = selectedFile;
                  const content = yield* Prettier.format(source);
                  yield* FileSystem.writeFileFromString(path, content);
                });
              }),
            );
          }),
          Effect.catchTags({
            PromptValidationError: _error => {
              return Effect.void;
            },
          }),
        );
      };

      return {
        build,
      };
    }),
    dependencies: [TreeTraversalService.layer, FileSystemService.layer],
  },
) {
  static layer = FileStructureBuilderService.Default;
}
