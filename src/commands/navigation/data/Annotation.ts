import { Array, Data, Match, Option, pipe, Predicate, Record, Schema } from 'effect';
import j, {
  TSBooleanKeyword,
  TSNumberKeyword,
  TSStringKeyword,
  TSTypeLiteral,
  TSTypeReference,
} from 'jscodeshift';

import { Expression } from './Expression';

type AttributeData = Data.TaggedEnum<{
  Object: {
    readonly key: string;
    readonly value: TSTypeLiteral;
  };
  String: {
    readonly key: string;
    readonly value: TSStringKeyword;
  };
  Number: {
    readonly key: string;
    readonly value: TSNumberKeyword;
  };
  Boolean: {
    readonly key: string;
    readonly value: TSBooleanKeyword;
  };
  Expression: {
    readonly key: string;
    readonly value: TSTypeReference;
  };
}>;

const Attribute = Data.taggedEnum<AttributeData>();

const isExpression = (record: unknown): record is typeof Expression.Type => {
  return Predicate.isObject(record) && '_tag' in record && record._tag === 'Expression';
};

export class Annotation extends Schema.Class<Annotation>('Annotation')({
  record: Schema.optional(
    Schema.Union(
      Schema.Record({
        key: Schema.String,
        value: Schema.Unknown,
      }),
      Expression,
    ),
  ),
}) {
  static fromRecord(record: Record<string, unknown> | typeof Expression.Type | undefined) {
    const props = Annotation.make({ record });
    return props.toTSTypeAnnotation();
  }

  private toTypeLiteral(record: Record<string, unknown>): TSTypeLiteral {
    const signatures = pipe(
      this.make(record),
      Array.filterMap(signature => {
        return Option.some(
          j.tsPropertySignature(j.identifier(signature.key), j.tsTypeAnnotation(signature.value)),
        );
      }),
    );

    return j.tsTypeLiteral(signatures);
  }

  private make(record: Record<string, unknown>) {
    return pipe(
      record,
      Record.toEntries,
      Array.filterMap(([key, value]) => {
        return Match.value(value).pipe(
          Match.withReturnType<Option.Option<AttributeData>>(),
          Match.when(Match.is('string'), _ => {
            return Option.some(
              Attribute.String({
                key,
                value: j.tsStringKeyword(),
              }),
            );
          }),
          Match.when(Match.is('number'), _ => {
            return Option.some(
              Attribute.Number({
                key,
                value: j.tsNumberKeyword(),
              }),
            );
          }),
          Match.when(Match.is('boolean'), _ => {
            return Option.some(
              Attribute.Boolean({
                key,
                value: j.tsBooleanKeyword(),
              }),
            );
          }),
          Match.when(isExpression, obj => {
            return Option.some(
              Attribute.Expression({
                key,
                value: j.tsTypeReference(j.identifier(obj.value)),
              }),
            );
          }),
          Match.when(Match.record, value => {
            return Option.some(
              Attribute.Object({
                key,
                value: this.toTypeLiteral(value),
              }),
            );
          }),
          Match.orElse(_ => {
            return Option.none();
          }),
        );
      }),
    );
  }

  toTSTypeAnnotation() {
    if (isExpression(this.record)) {
      return j.tsTypeAnnotation(j.tsTypeReference(j.identifier(this.record.value)));
    }

    const signatures = pipe(
      Option.fromNullable(this.record),
      Option.flatMapNullable(record => {
        return this.make(record);
      }),
      Option.getOrElse(() => {
        return [];
      }),
      Array.map(signature => {
        return j.tsPropertySignature(
          j.identifier(signature.key),
          j.tsTypeAnnotation(signature.value),
        );
      }),
    );

    return j.tsTypeAnnotation(j.tsTypeLiteral(signatures));
  }
}
