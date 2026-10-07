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
export {fromMarkdown} from './lib/index.js'
export {createOffsetMap} from './lib/offset-map.js'
export type {OffsetMap} from './lib/offset-map.js'

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    listItem: 'listItem'
  }

  interface Token {
    _spread?: boolean
  }
}
