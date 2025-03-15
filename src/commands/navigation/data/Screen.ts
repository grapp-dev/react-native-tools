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
  Tuple,
} from 'effect';
import j, { Identifier, JSXElement, ObjectExpression } from 'jscodeshift';
import Mustache from 'mustache';

import { Annotation } from './Annotation';
import { Config } from './Config';
import { Expression } from './Expression';
import { GraphElement } from './GraphElement';
import { Parent } from './Parent';
import { Props } from './Props';

const makeRouteObjectExpression = (
  path: string,
  params?: ObjectExpression | Identifier,
): ObjectExpression => {
  const paramsProperty = params ? j.objectProperty(j.identifier('params'), params) : undefined;

  if (paramsProperty) {
    paramsProperty.shorthand = true;
  }

  const properties = Array.filter(
    [j.objectProperty(j.identifier('screen'), j.stringLiteral(path)), paramsProperty],
    Predicate.isNotNullable,
  );

  return j.objectExpression(properties);
};

export class Screen extends Schema.TaggedClass<Screen>()('Screen', {
  name: Schema.String,
  lazy: Schema.optional(Schema.Boolean),
  type: Schema.optionalWith(Schema.Literal('Screen', 'Navigator'), {
    default: Function.constant('Screen' as const),
  }),
  path: Schema.optional(Schema.String),
  props: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }),
  ),
  params: Schema.optional(
    Schema.Union(
      Schema.Record({
        key: Schema.String,
        value: Schema.Unknown,
      }),
      Expression,
    ),
  ),
  parent: Parent.Both,
  config: Config,
}) {
  private get isLazy() {
    return this.lazy ?? this.config.lazy;
  }

  private get navigatorName() {
    const name = this.parent.navigatorName;

    if (name === '') {
      return this.parent._tag === 'Group' ? this.parent.parent?.name ?? '' : this.parent.name;
    }

    return name;
  }

  private get importPath() {
    if (this.path) {
      return this.path;
    }

    return pipe(
      this.parent.importPath,
      Array.prepend(this.config.path),
      Array.append(this.name),
      Array.filter(String.isNonEmpty),
      Array.join('/'),
    );
  }

  private get importSpecifier() {
    const name = this.type === 'Navigator' ? String.concat(this.name, 'Navigator') : this.name;
    const matcher = Match.type<typeof Parent.Both.Type>().pipe(
      Match.tag('Navigator', parent => {
        if (parent.reference) {
          return name;
        }

        return String.concat(parent.importSpecifier, name);
      }),
      Match.tag('Group', parent => {
        return String.concat(parent.importSpecifier, name);
      }),
      Match.exhaustive,
    );

    return matcher(this.parent);
  }

  private get routeName() {
    return String.concat('route', this.importSpecifier);
  }

  private get routeLiteral() {
    return String.concat(this.parent.routeLiteral, this.name);
  }

  toFileTemplate() {
    if (this.config.template) {
      const templates = pipe(
        this.config.template,
        Record.toEntries,
        Array.map(([name, template]) => {
          const object = {
            component: {
              name: this.importSpecifier,
            },
          };

          const compiledName = Mustache.render(name, object);
          const compiledContent = Mustache.render(template, object);

          return Tuple.make(Array.join([this.importPath, compiledName], '/'), compiledContent);
        }),
      );

      return Array.isEmptyArray(templates) ? Option.none() : Option.some(templates);
    }

    return Option.none();
  }

  toGraphElement() {
    return GraphElement.make({
      type: 'Screen',
      name: this.name,
      parent: this.parent,
      path: this.importPath,
      props: this.props,
    });
  }

  toImportSpecifier() {
    return this.isLazy
      ? Option.none()
      : Option.some(
          Tuple.make(this.importPath, j.importSpecifier(j.identifier(this.importSpecifier))),
        );
  }

  toRouteLiteralVariable() {
    return j.exportNamedDeclaration(
      j.variableDeclaration('const', [
        j.variableDeclarator(j.identifier(this.routeName), j.stringLiteral(this.routeLiteral)),
      ]),
    );
  }

  toRouteExpression() {
    const name = pipe(
      this.parent.routePath,
      Array.map(element => element.name),
      Array.append(this.name),
    );

    const routePath =
      this.parent._tag === 'Group' && this.parent.reference ? [Array.join(name, '')] : name;

    const routeLiterals = pipe(
      routePath,
      Array.filter(String.isNonEmpty),
      Array.reduce([] as ReadonlyArray<string>, (acc, path, index) => {
        const string = pipe(
          acc,
          Array.get(Number.decrement(index)),
          Option.map(head => {
            return Array.join([head, path], '');
          }),
          Option.getOrElse(Function.constant(path)),
        );

        return Array.append(acc, string);
      }),
      Array.filter((_path, index) => {
        return pipe(
          this.parent.routePath,
          Array.get(index),
          Option.map(element => {
            return !(element._tag === 'Group' && !element.reference);
          }),
          Option.getOrElse(Function.constTrue),
        );
      }),
    );

    const maybeObjectExpression = pipe(
      routeLiterals,
      Array.reduceRight(Option.none<ObjectExpression>(), (maybeAcc, path, index) => {
        if (index === routeLiterals.length - 1) {
          return Option.some(
            makeRouteObjectExpression(path, this.params ? j.identifier('params') : undefined),
          );
        }

        const acc = Option.getOrUndefined(maybeAcc);
        return Option.some(makeRouteObjectExpression(path, acc));
      }),
    );
    const objectExpression = Option.getOrThrow(maybeObjectExpression);
    const asExpression = j.tsAsExpression(
      objectExpression,
      j.tsTypeReference(j.identifier('const')),
    );
    const params = j.identifier('params');

    if (this.params) {
      params.typeAnnotation = Annotation.fromRecord(this.params);
    }

    const arrowFunctionExpression = j.arrowFunctionExpression(
      [params],
      j.blockStatement([j.returnStatement(asExpression)]),
    );

    const variableDeclaration = j.variableDeclaration('const', [
      j.variableDeclarator(
        j.identifier(`to${this.importSpecifier}`),
        this.params ? arrowFunctionExpression : asExpression,
      ),
    ]);

    return j.exportNamedDeclaration(variableDeclaration);
  }

  toJSX(): JSXElement {
    const jsxElementName = j.jsxMemberExpression(
      j.jsxIdentifier(`${this.navigatorName}Stack`),
      j.jsxIdentifier(this._tag),
    );

    const getComponent = this.isLazy
      ? j.arrowFunctionExpression(
          [],
          j.memberExpression(
            j.callExpression(j.identifier('require'), [j.literal(this.importPath)]),
            j.identifier(this.importSpecifier),
          ),
        )
      : undefined;

    const component = this.isLazy ? undefined : j.identifier(this.importSpecifier);

    const props = {
      ...this.props,
      name: j.memberExpression(j.identifier('route'), j.identifier(this.routeName)),
      getComponent,
      component,
    };

    const jsxOpeningElement = j.jsxOpeningElement(jsxElementName, Props.fromRecord(props));
    jsxOpeningElement.selfClosing = true;

    return j.jsxElement(jsxOpeningElement);
  }
}
