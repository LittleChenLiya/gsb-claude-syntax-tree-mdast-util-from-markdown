export type {Encoding, Token, Value} from 'micromark-util-types'
export type {
  CompileContext,
  CompileData,
  Extension,
  Handles,
  Handle,
  OnEnterError,
  OnExitError,
  Options,
  Transform
} from './lib/types.js'
export type {DefinitionConflict} from './lib/definition-conflicts.js'
export {definitionConflicts} from './lib/definition-conflicts.js'
export {fromMarkdown} from './lib/index.js'

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    listItem: 'listItem'
  }

  interface Token {
    _spread?: boolean
  }
}
