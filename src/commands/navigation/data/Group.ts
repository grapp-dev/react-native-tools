import { Array, Schema } from 'effect';
import j, { JSXElement } from 'jscodeshift';

import { Config } from './Config';
import { GraphElement } from './GraphElement';
import { Parent } from './Parent';
import { Props } from './Props';
import { Screen } from './Screen';

export class Group extends Schema.TaggedClass<Group>()('Group', {
  name: Schema.String,
  path: Schema.optional(Schema.String),
  props: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }),
  ),
  children: Schema.Array(Screen),
  parent: Schema.optional(Parent.Navigator),
  config: Config,
}) {
  private get navigatorName() {
    if (this.parent) {
      const name = this.parent.navigatorName;

      if (name === '' && this.parent._tag === 'Navigator') {
        return this.parent.name;
      }

      return name;
    }

    return this.name;
  }

  toGraphElement() {
    return GraphElement.make({
      type: 'Group',
      name: this.name,
      parent: this.parent,
      props: this.props,
    });
  }

  toJSX(): JSXElement {
    const jsxElementName = j.jsxMemberExpression(
      j.jsxIdentifier(`${this.navigatorName}Stack`),
      j.jsxIdentifier(this._tag),
    );

    const jsxOpeningElement = j.jsxOpeningElement(jsxElementName, Props.fromRecord(this.props));
    const jsxClosingElement = j.jsxClosingElement(jsxElementName);
    const children = Array.map(this.children, element => {
      return element.toJSX();
    });

    return j.jsxElement(jsxOpeningElement, jsxClosingElement, children);
  }
}
