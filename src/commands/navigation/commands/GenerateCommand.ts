import { Command } from '@effect/cli';

import { Effect, pipe } from 'effect';

import { GlobService } from '../../../services';
import {
  FileStructureBuilderService,
  GraphBuilderService,
  NavigationBuilderService,
  RoutesBuilderService,
} from '../services';

export const GenerateCommand = Command.make('generate', {}, _config => {
  return pipe(
    Effect.gen(function* (_) {
      const Glob = yield* GlobService;
      const files = yield* Glob.find('**/navigation.jsonnet');

      yield* Effect.forEach(files, file => {
        return Effect.all([
          NavigationBuilderService.build(file),
          RoutesBuilderService.build(file),
          GraphBuilderService.build(file),
          FileStructureBuilderService.build(file),
        ]);
      });
    }),
    Effect.provide([
      NavigationBuilderService.layer,
      RoutesBuilderService.layer,
      GraphBuilderService.layer,
      FileStructureBuilderService.layer,
    ]),
  );
});
