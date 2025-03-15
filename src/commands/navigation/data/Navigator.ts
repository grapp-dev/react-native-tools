import { Array, Function, Match, Option, Predicate, Schema, String, Tuple, Types } from 'effect';
import j, { JSXElement } from 'jscodeshift';

import { Config } from './Config';
import { GraphElement } from './GraphElement';
import { Group } from './Group';
import { Parent } from './Parent';
import { Props } from './Props';
import { Screen } from './Screen';

type Element = Navigator | Group | Screen;

type NavigatorEncoded = {
  readonly name: string;
  readonly config: {
    readonly path: string;
    readonly lazy?: boolean | undefined;
  };
  readonly root?: boolean | undefined;
  readonly children: readonly (typeof Screen.Encoded | typeof Group.Encoded | NavigatorEncoded)[];
  readonly parent?: typeof Parent.Navigator.Encoded | undefined;
  readonly _tag: 'Navigator';
  readonly export?: boolean | undefined;
  readonly path?: string | undefined;
  readonly type?: 'bottom-tab' | 'native-stack' | 'stack' | readonly [string, string] | undefined;
  readonly props?: Record<string, unknown> | undefined;
};

export class Navigator extends Schema.TaggedClass<Navigator>()('Navigator', {
  name: Schema.String,
  export: Schema.optional(Schema.Boolean),
  root: Schema.optional(Schema.Boolean),
  path: Schema.optional(Schema.String),
  type: Schema.optionalWith(
    Schema.Union(
      Schema.Literal('bottom-tab', 'native-stack', 'stack'),
      Schema.Tuple(Schema.String, Schema.String),
    ),
    { default: Function.constant('native-stack' as const) },
  ),
  props: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }),
  ),
  children: Schema.Array(
    Schema.Union(
      Screen,
      Group,
      Schema.suspend((): Schema.Schema<Navigator, NavigatorEncoded> => {
        return Navigator;
      }),
    ),
  ),
  parent: Schema.optional(Parent.Navigator),
  config: Config,
}) {
  static mapType(type: (typeof Navigator.Type)['type']) {
    return Match.value(type).pipe(
      Match.withReturnType<Types.TupleOf<2, string>>(),
      Match.when('native-stack', () =>
        Tuple.make('createNativeStackNavigator', '@react-navigation/native-stack'),
      ),
      Match.when('bottom-tab', () =>
        Tuple.make('createBottomTabNavigator', '@react-navigation/bottom-tabs'),
      ),
      Match.when('stack', () => Tuple.make('createStackNavigator', '@react-navigation/stack')),
      Match.orElse(value => {
        return Tuple.make(...value);
      }),
    );
  }

  static isEmpty(
    path: string | undefined,
    children: (typeof Navigator.Type)['children'],
  ): path is string {
    return Array.isEmptyReadonlyArray(children) && Predicate.isString(path);
  }

  private toScreen(navigator: typeof Navigator.Type) {
    const reference = Navigator.isEmpty(navigator.path, navigator.children);

    return Screen.make({
      name: navigator.name,
      config: this.config,
      lazy: false,
      type: 'Navigator',
      parent: Parent.Navigator.make({
        name: this.name,
        parent: this.parent,
        reference,
        root: this.root,
      }),
    });
  }

  private get navigatorName() {
    if (this.parent) {
      return String.concat(this.parent.navigatorName, this.name);
    }

    return this.name;
  }

  toGraphElement() {
    return GraphElement.make({
      type: 'Navigator',
      name: this.name,
      parent: this.parent,
      props: this.props,
    });
  }

  toRouteLiteralVariable() {
    return Array.filterMap(this.children, child => {
      if (child._tag === 'Navigator') {
        const screen = this.toScreen(child);
        return Option.some(screen.toRouteLiteralVariable());
      }

      return Option.none();
    });
  }

  toJSX(): JSXElement {
    const jsxElementName = j.jsxMemberExpression(
      j.jsxIdentifier(`${this.navigatorName}Stack`),
      j.jsxIdentifier(this._tag),
    );

    const jsxOpeningElement = j.jsxOpeningElement(jsxElementName, Props.fromRecord(this.props));
    const jsxClosingElement = j.jsxClosingElement(jsxElementName);

    const jsxChildren = Array.map(
      this.children,
      Match.type<Element>().pipe(
        Match.tag('Screen', 'Group', child => {
          return child.toJSX();
        }),
        Match.tag('Navigator', child => {
          const screen = this.toScreen(child);
          return screen.toJSX();
        }),
        Match.exhaustive,
      ),
    );

    return j.jsxElement(jsxOpeningElement, jsxClosingElement, jsxChildren);
  }

  toExternalImport() {
    if (Navigator.isEmpty(this.path, this.children)) {
      return Option.some(
        Tuple.make(this.path, j.importSpecifier(j.identifier(`${this.name}Navigator`))),
      );
    }

    return Option.none();
  }

  toVariableDeclaration() {
    if (Navigator.isEmpty(this.path, this.children)) {
      return Option.none();
    }

    const [callExpressionName] = Navigator.mapType(this.type);
    const callExpression = j.callExpression(j.identifier(callExpressionName), []);

    return Option.some(
      j.variableDeclaration('const', [
        j.variableDeclarator(j.identifier(`${this.navigatorName}Stack`), callExpression),
      ]),
    );
  }

  toComponentDeclaration() {
    if (Navigator.isEmpty(this.path, this.children)) {
      return Option.none();
    }

    const arrowFunction = j.arrowFunctionExpression(
      [],
      j.blockStatement([j.returnStatement(this.toJSX())]),
    );

    const variable = j.variableDeclaration('const', [
      j.variableDeclarator(j.identifier(`${this.navigatorName}Navigator`), arrowFunction),
    ]);

    return Option.some(this.export ? j.exportNamedDeclaration(variable) : variable);
  }
}
