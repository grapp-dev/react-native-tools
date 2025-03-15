import { Schema } from 'effect';

import { Config } from './Config';
import { Group } from './Group';
import { Navigator } from './Navigator';

export const Tree = Schema.Struct({
  config: Config,
  groups: Schema.optional(Schema.Array(Group)),
  navigators: Schema.Array(Navigator),
});
