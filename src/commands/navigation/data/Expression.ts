import { Schema } from 'effect';

export class Expression extends Schema.TaggedClass<Expression>()('Expression', {
  value: Schema.String,
  use: Schema.optional(Schema.Tuple(Schema.String, Schema.String)),
}) {}
