/**
 * @import {Definition, Nodes} from 'mdast'
 */

/**
 * Report on definitions that share a normalized identifier with an earlier
 * definition but point at a different URL.
 *
 * @typedef {object} DefinitionConflict
 *   Report on conflicting definitions.
 * @property {Array<Definition>} conflicts
 *   Later definitions with the same normalized identifier as `first` but a
 *   different URL;
 *   these are ignored when rendering.
 * @property {Definition} first
 *   First definition for the identifier;
 *   this is the definition used when rendering.
 * @property {string} identifier
 *   Normalized identifier shared by `first` and everything in `conflicts`.
 */

/**
 * Find definitions that conflict with an earlier definition.
 *
 * Definitions are compared by their normalized identifier, following the
 * same label normalization that is used to match references.
 * The first definition for an identifier is the one used when rendering;
 * later definitions with the same identifier but a different URL are
 * reported as conflicts, with their positions.
 * Later definitions with the same identifier and the same URL are redundant
 * and not reported.
 * Definition-like text in code (flow or text) is not parsed as a definition
 * and hence never reported.
 *
 * @param {Nodes} tree
 *   mdast tree to check.
 * @returns {Array<DefinitionConflict>}
 *   Conflicting definitions, grouped by normalized identifier, in document
 *   order.
 */
export function definitionConflicts(tree) {
  /** @type {Map<string, Definition>} */
  const firsts = new Map()
  /** @type {Map<string, DefinitionConflict>} */
  const resultsByIdentifier = new Map()
  /** @type {Array<DefinitionConflict>} */
  const results = []

  visit(tree)

  return results

  /**
   * @param {Nodes} node
   *   Node to check.
   * @returns {undefined}
   *   Nothing.
   */
  function visit(node) {
    if (node.type === 'definition') {
      const first = firsts.get(node.identifier)

      if (first) {
        if (node.url !== first.url) {
          let result = resultsByIdentifier.get(node.identifier)

          if (!result) {
            result = {conflicts: [], first, identifier: node.identifier}
            resultsByIdentifier.set(node.identifier, result)
            results.push(result)
          }

          result.conflicts.push(node)
        }
      } else {
        firsts.set(node.identifier, node)
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        visit(child)
      }
    }
  }
}
