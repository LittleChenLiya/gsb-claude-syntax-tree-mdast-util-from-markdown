export type {Encoding, Token, Value} from 'micromark-util-types'
export type {
  CompileContext,
  CompileData,
  Diagnostic,
  Extension,
  Handles,
  Handle,
  OnEnterError,
  OnExitError,
  Options,
  Transform
} from './lib/types.js'
export {fromMarkdown} from './lib/index.js'

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    listItem: 'listItem'
  }

  interface Token {
    _spread?: boolean
  }
}
