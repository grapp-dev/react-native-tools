import { Array, Option, pipe, Schema } from 'effect';

type NavigatorEncoded = {
  readonly _tag: 'Navigator';
  readonly name: string;
  readonly parent?: NavigatorEncoded | undefined;
  readonly reference: boolean;
  readonly root?: boolean | undefined;
};

const traverse = (
  element: typeof Navigator.Type | typeof Group.Type,
  path = [] as ReadonlyArray<typeof Navigator.Type | typeof Group.Type>,
): Array.NonEmptyArray<typeof Navigator.Type | typeof Group.Type> => {
  if (element.parent) {
    return traverse(element.parent, Array.prepend(path, element));
  }
  return Array.prepend(path, element);
};

const join = Array.join('');

class Navigator extends Schema.TaggedClass<Navigator>()('Navigator', {
  name: Schema.String,
  parent: Schema.optional(
    Schema.suspend((): Schema.Schema<Navigator, NavigatorEncoded> => {
      return Navigator;
    }),
  ),
  reference: Schema.Boolean,
  root: Schema.optional(Schema.Boolean),
}) {
  private get navigators() {
    return Array.filter(traverse(this), navigator => {
      return navigator._tag === 'Navigator' && !navigator.root;
    });
  }

  private get names() {
    return Array.map(this.navigators, navigator => {
      return navigator.name;
    });
  }

  get navigatorName() {
    return join(this.names);
  }

  get importSpecifier() {
    return join(this.names);
  }

  get importPath() {
    return this.names;
  }

  get routeLiteral() {
    return join(this.names);
  }

  get routePath() {
    return this.navigators;
  }

  get graphName() {
    return pipe(
      traverse(this),
      Array.map(element => element.name),
      join,
    );
  }
}

class Group extends Schema.TaggedClass<Group>()('Group', {
  name: Schema.String,
  parent: Schema.optional(Navigator),
  reference: Schema.Boolean,
}) {
  private get navigators() {
    return Array.filterMap(traverse(this), element => {
      if (element._tag === 'Navigator' && !element.root) {
        return Option.some(element);
      }

      return Option.none();
    });
  }

  private get all() {
    return Array.filterMap(traverse(this), element => {
      if ((element._tag === 'Navigator' && !element.root) || element._tag === 'Group') {
        return Option.some(element);
      }

      return Option.none();
    });
  }

  private get names() {
    return Array.map(this.all, navigator => navigator.name);
  }

  get navigatorName(): string {
    return pipe(
      this.navigators,
      Array.map(navigator => navigator.name),
      join,
    );
  }

  get importSpecifier(): string {
    if (this.reference) {
      return this.name;
    }

    return join(this.names);
  }

  get importPath() {
    if (this.reference) {
      return [this.name];
    }

    return this.names;
  }

  get routeLiteral() {
    return join(this.reference ? [this.name] : this.names);
  }

  get routePath() {
    return this.reference ? [this] : this.all;
  }

  get graphName() {
    return pipe(
      traverse(this),
      Array.map(element => element.name),
      join,
    );
  }
}

const Both = Schema.Union(Group, Navigator);

export const Parent = {
  Both,
  Group,
  Navigator,
};
