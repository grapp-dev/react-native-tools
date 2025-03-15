import { Array, pipe, Schema, String } from 'effect';

import { Group } from './Group';
import { Navigator } from './Navigator';
import { Screen } from './Screen';

import { TreeTraversalData } from '../services';

const TEMPLATE = `digraph G {
  layout=circo;
  graph [
    nodesep=2.0,
    ranksep=2.0,
    splines="curved",  
    overlap=false, 
    pad=1.5,
    sep="+2.0,2.0",
    defaultdist=0.1,
    mindist=0.1
  ];
  {{content}}
}`;

const traverse = (
  children: ReadonlyArray<Screen | Navigator | Group>,
  arr = [] as ReadonlyArray<Screen | Navigator | Group>,
): ReadonlyArray<Screen | Navigator | Group> => {
  return Array.reduce(children, arr, (acc, child) => {
    if ('children' in child) {
      return traverse(child.children, Array.prepend(acc, child));
    }

    return Array.append(acc, child);
  });
};

export class Graph extends Schema.TaggedClass<Graph>()('Graph', {
  children: Schema.Array(Schema.Union(Navigator, Group, Screen)),
}) {
  static fromTree(tree: TreeTraversalData) {
    const graph = Graph.make({
      children: tree.tree.navigators,
    });

    return graph.toString();
  }

  toString() {
    const content = pipe(
      traverse(this.children),
      Array.map(child => {
        return child.toGraphElement().toString();
      }),
      Array.join('\n  '),
    );

    return pipe(TEMPLATE, String.replace('{{content}}', content));
  }
}
