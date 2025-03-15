import { Function, Schema } from 'effect';

export const Config = Schema.Struct({
  path: Schema.String,
  lazy: Schema.optionalWith(Schema.Boolean, { default: Function.constTrue }),
  template: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.String,
    }),
  ),
});
