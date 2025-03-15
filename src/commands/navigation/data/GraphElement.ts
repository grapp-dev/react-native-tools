import {
  Array,
  Function,
  Match,
  Number,
  Option,
  pipe,
  Predicate,
  Record,
  Schema,
  String,
} from 'effect';

import { Expression } from './Expression';
import { Parent } from './Parent';

const padStartFactory = (depth: number, string: string, char = '&nbsp;') => {
  return String.padStart(depth * 2 * char.length + string.length, char);
};

export class GraphElement extends Schema.Class<GraphElement>('GraphElement')({
  type: Schema.Literal('Navigator', 'Group', 'Screen'),
  name: Schema.String,
  parent: Schema.optional(Parent.Both),
  path: Schema.optional(Schema.String),
  props: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }),
  ),
}) {
  private stringifyObject(record: Record<string, unknown>, depth = 0): string {
    return pipe(
      record,
      Record.toEntries,
      Array.filterMap(([key, value]) => {
        const name = depth === 0 ? String.capitalize(key) : key;

        const matcher = Match.type().pipe(
          Match.withReturnType<Option.Option<string>>(),
          Match.when(
            (object: unknown): object is Expression => {
              return Predicate.isObject(object) && '_tag' in object && object._tag === 'Expression';
            },
            _expression => {
              const string = `${name}: <i>Expression</i>`;
              return pipe(string, padStartFactory(depth, string), Option.some);
            },
          ),
          Match.when(Predicate.isRecord, object => {
            const props = this.stringifyObject(object, Number.increment(depth));
            const string = `${name}:<br align="left" />`;
            return pipe(string, padStartFactory(depth, string), String.concat(props), Option.some);
          }),
          Match.whenOr(Match.string, Match.boolean, Match.number, value => {
            const string = `${name}: ${value}`;
            return pipe(string, padStartFactory(depth, string), Option.some);
          }),
          Match.orElse(_ => {
            return Option.none();
          }),
        );

        return matcher(value);
      }),
      Array.join('<br align="left" />'),
    );
  }

  private get color() {
    return Match.value(this.type).pipe(
      Match.when('Navigator', Function.constant('#FDE33A')),
      Match.when('Group', Function.constant('#F6ACD8')),
      Match.when('Screen', Function.constant('#C3EFE0')),
      Match.exhaustive,
    );
  }

  private get weight() {
    return Match.value(this.type).pipe(
      Match.when('Navigator', Function.constant(10)),
      Match.when('Group', Function.constant(2)),
      Match.when('Screen', Function.constant(0.1)),
      Match.exhaustive,
    );
  }

  private get style() {
    const style = {
      shape: 'box',
      fillcolor: this.color,
      style: 'filled',
      fontname: 'monospace',
      fontsize: 16,
      margin: '0.3,0.2',
      penwidth: 1.5,
    };

    return pipe(
      style,
      Record.toEntries,
      Array.map(([key, value]) => {
        return `${key}="${value}"`;
      }),
      Array.join(', '),
    );
  }

  toString() {
    const props = this.stringifyObject({
      [this.type]: `<b>${this.name}</b>`,
      path: this.path,
      props: this.props,
    });

    if (this.parent) {
      const name = String.concat(this.parent.graphName, this.name);

      return Array.join(
        [
          `${name} [label=<${props}> ${this.style}, weight=${this.weight}];`,
          `${this.parent.graphName} -> ${name} [dir="forward"]`,
        ],
        '\n',
      );
    }

    return Array.join(
      [`${this.name} [label=<${props}> ${this.style}];`, `${this.name} [weight=${this.weight}]`],
      '\n',
    );
  }
}
