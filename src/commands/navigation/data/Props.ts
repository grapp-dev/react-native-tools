import { Array, Data, Match, Option, pipe, Predicate, Record, Schema } from 'effect';
import j, {
  ArrowFunctionExpression,
  Identifier,
  MemberExpression,
  ObjectExpression,
  StringLiteral,
} from 'jscodeshift';

type Expression = ArrowFunctionExpression | MemberExpression | Identifier;
type CustomExpression = {
  _tag: 'Expression';
  value: string;
};

type AttributeData = Data.TaggedEnum<{
  Object: {
    readonly key: string;
    readonly value: ObjectExpression;
  };
  String: {
    readonly key: string;
    readonly value: StringLiteral;
  };
  Template: {
    readonly key: string;
    readonly value: Expression;
  };
  Expression: {
    readonly key: string;
    readonly value: Expression;
  };
}>;

export const Attribute = Data.taggedEnum<AttributeData>();

export class Props extends Schema.Class<Props>('Props')({
  record: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }),
  ),
}) {
  static fromRecord(record: Record<string, unknown> | undefined) {
    const props = Props.make({ record });
    return props.toJSX();
  }

  private toObjectExpression(record: Record<string, unknown>): ObjectExpression {
    const properties = pipe(
      this.make(record),
      Array.filterMap(attribute => {
        return Option.some(j.objectProperty(j.identifier(attribute.key), attribute.value));
      }),
    );

    return j.objectExpression(properties);
  }

  private make(record: Record<string, unknown>) {
    return pipe(
      record,
      Record.toEntries,
      Array.filterMap(([key, value]) => {
        const matcher = Match.type().pipe(
          Match.withReturnType<Option.Option<AttributeData>>(),
          Match.when(Match.string, value => {
            return Option.some(
              Attribute.String({
                key,
                value: j.stringLiteral(value),
              }),
            );
          }),
          Match.whenOr(Match.number, Match.boolean, value => {
            return Option.some(
              Attribute.Template({
                key,
                value: j.template.expression([value]),
              }),
            );
          }),
          Match.when(
            (obj: unknown): obj is CustomExpression => {
              return Predicate.isObject(obj) && '_tag' in obj && obj._tag === 'Expression';
            },
            obj => {
              return Option.some(
                Attribute.Expression({
                  key,
                  value: j.template.expression([obj.value]),
                }),
              );
            },
          ),
          Match.when(
            (value: unknown): value is Expression => {
              return Predicate.isObject(value) && 'type' in value;
            },
            value => {
              return Option.some(
                Attribute.Expression({
                  key,
                  value,
                }),
              );
            },
          ),
          Match.when(Match.record, value => {
            return Option.some(
              Attribute.Object({
                key,
                value: this.toObjectExpression(value),
              }),
            );
          }),
          Match.orElse(_ => {
            return Option.none();
          }),
        );

        return matcher(value);
      }),
    );
  }

  get attributes() {
    return pipe(
      Option.fromNullable(this.record),
      Option.flatMapNullable(record => {
        return this.make(record);
      }),
      Option.getOrElse(() => {
        return [];
      }),
    );
  }

  toJSX() {
    return Array.map(this.attributes, attribute => {
      return j.jsxAttribute(
        j.jsxIdentifier(attribute.key),
        j.jsxExpressionContainer(attribute.value),
      );
    });
  }
}
