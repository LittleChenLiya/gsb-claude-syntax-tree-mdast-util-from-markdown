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
  SourcePositionMap,
  Transform
} from './lib/types.js'
export {createSourcePositionMap} from './lib/source-position-map.js'
export {fromMarkdown} from './lib/index.js'

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    listItem: 'listItem'
  }

  interface Token {
    _spread?: boolean
  }
}
