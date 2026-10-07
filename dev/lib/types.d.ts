import type {Nodes, Parent, PhrasingContent, Root} from 'mdast'
import type {ParseOptions, Token} from 'micromark-util-types'
import type {Position} from 'unist'

/**
 * A parse diagnostic;
 * something in the markdown that parses fine, but is likely a mistake.
 *
 * Diagnostics do not change the resulting syntax tree: parsing still produces
 * the same mdast tree, it additionally reports these findings.
 */
export interface Diagnostic {
  /**
   * Machine readable code of the diagnostic.
   *
   * `unclosed-code-fence`
   *   — a fenced code block is not closed before the end of the document.
   */
  code: 'unclosed-code-fence'
  /**
   * Opening marker of the unclosed code fence (such as `` ``` `` or `~~~`).
   *
   * The expected closing marker is a fence of the same character that is at
   * least as long as this opening marker.
   */
  fence: string
  /**
   * Human readable info about the diagnostic.
   */
  message: string
  /**
   * Place of the thing the diagnostic is about;
   * the location of the opening code fence.
   */
  position: Position
}

/**
 * Sink that receives parse diagnostics.
 *
 * Pass an array to collect diagnostics, or a listener that is called for each
 * diagnostic. Omit (or pass `null`/`undefined`) to not produce diagnostics.
 */
export type Diagnostics = Array<Diagnostic> | DiagnosticListener

/**
 * Listen for parse diagnostics.
 *
 * @param diagnostic
 *   Diagnostic.
 * @returns
 *   Nothing.
 */
export type DiagnosticListener = (diagnostic: Diagnostic) => undefined | void

/**
 * Compiler context.
 */
export interface CompileContext {
  /**
   * Configuration.
   */
  config: Config
  /**
   * Info passed around;
   * key/value store.
   */
  data: CompileData
  /**
   * Stack of nodes.
   */
  stack: Array<Fragment | Nodes>
  /**
   * Stack of tokens.
   */
  tokenStack: Array<TokenTuple>

  /**
   * Capture some of the output data.
   *
   * @param this
   *   Context.
   * @returns
   *   Nothing.
   */
  buffer(this: CompileContext): undefined

  /**
   * Enter a node.
   *
   * @param this
   *   Context.
   * @param node
   *   Node.
   * @param token
   *   Token.
   * @param onError
   *   Error handler.
   * @returns
   *   Nothing.
   */
  enter(
    this: CompileContext,
    node: Nodes,
    token: Token,
    onError?: OnEnterError | null | undefined
  ): undefined

  /**
   * Exit a node.
   *
   * @param this
   *   Context.
   * @param token
   *   Token.
   * @param onError
   *   Error handler.
   * @returns
   *   Nothing.
   */
  exit(
    this: CompileContext,
    token: Token,
    onError?: OnExitError | null | undefined
  ): undefined

  /**
   * Stop capturing and access the output data.
   *
   * @param this
   *   Context.
   * @returns
   *   Nothing.
   */
  resume(this: CompileContext): string

  /**
   * Get the source text that spans a token (or location).
   *
   * @param token
   *   Start/end in stream.
   * @param expandTabs
   *   Whether to expand tabs.
   * @returns
   *   Serialized chunks.
   */
  sliceSerialize(
    token: Pick<Token, 'end' | 'start'>,
    expandTabs?: boolean | undefined
  ): string
}

/**
 * Interface of tracked data.
 *
 * When working on extensions that use more data, extend the corresponding
 * interface to register their types:
 *
 * ```ts
 * declare module 'mdast-util-from-markdown' {
 *   interface CompileData {
 *     // Register a new field.
 *     mathFlowInside?: boolean | undefined
 *   }
 * }
 * ```
 */
export interface CompileData {
  /**
   * Whether we’re inside a hard break.
   */
  atHardBreak?: boolean | undefined

  /**
   * Current character reference type.
   */
  characterReferenceType?:
    | 'characterReferenceMarkerHexadecimal'
    | 'characterReferenceMarkerNumeric'
    | undefined

  /**
   * Whether a first list item value (`1` in `1. a`) is expected.
   */
  expectingFirstListItemValue?: boolean | undefined

  /**
   * Whether we’re in flow code.
   */
  flowCodeInside?: boolean | undefined

  /**
   * Whether we’re in a reference.
   */
  inReference?: boolean | undefined

  /**
   * Whether we’re expecting a line ending from a setext heading, which can be slurped.
   */
  setextHeadingSlurpLineEnding?: boolean | undefined

  /**
   * Current reference.
   */
  referenceType?: 'collapsed' | 'full' | undefined
}

/**
 * Configuration.
 *
 * We have our defaults, but extensions will add more.
 */
export interface Config {
  /**
   * Listeners called for every token, after closing handles.
   */
  afterExit: Array<Handle>
  /**
   * Listeners called for every token, before opening handles.
   */
  beforeEnter: Array<Handle>
  /**
   * Token types where line endings are used.
   */
  canContainEols: Array<string>
  /**
   * Opening handles.
   */
  enter: Handles
  /**
   * Closing handles.
   */
  exit: Handles
  /**
   * Tree transforms.
   */
  transforms: Array<Transform>
}

/**
 * Change how markdown tokens from micromark are turned into mdast.
 *
 * ###### Notes
 *
 * Handles (`enter`, `exit`) create the tree;
 * a later handle for a token type from an extension overwrites earlier ones.
 * Listeners (`afterExit`, `beforeEnter`) observe all tokens including unhandled
 * ones.
 * The point of listeners is that they *do not* interfere with handling,
 * potentially changed by extensions.
 * Don’t modify unexpected things!
 */
export interface Extension {
  /**
   * Listener called for every token, after closing handles.
   */
  afterExit?: Handle | null | undefined
  /**
   * Listener called for every token, before opening handles.
   */
  beforeEnter?: Handle | null | undefined
  /**
   * Token types where line endings are used.
   */
  canContainEols?: Array<string> | null | undefined
  /**
   * Opening handles.
   */
  enter?: Handles | null | undefined
  /**
   * Closing handles.
   */
  exit?: Handles | null | undefined
  /**
   * Tree transforms.
   */
  transforms?: Array<Transform> | null | undefined
}

/**
 * Internal fragment.
 */
export interface Fragment extends Parent {
  /**
   * Node type.
   */
  type: 'fragment'
  /**
   * Children.
   */
  children: Array<PhrasingContent>
}

/**
 * Token types mapping to handles
 */
export type Handles = Record<string, Handle>

/**
 * Handle a token.
 *
 * @param this
 *   Context.
 * @param token
 *   Current token.
 * @returns
 *   Nothing.
 */
export type Handle = (this: CompileContext, token: Token) => undefined | void

/**
 * Handle the case where the `right` token is open, but it is closed (by the
 * `left` token) or because we reached the end of the document.
 *
 * @param this
 *   Context.
 * @param left
 *   Left token.
 * @param right
 *   Right token.
 * @returns
 *   Nothing.
 */
export type OnEnterError = (
  this: Omit<CompileContext, 'sliceSerialize'>,
  left: Token | undefined,
  right: Token
) => undefined

/**
 * Handle the case where the `right` token is open but it is closed by
 * exiting the `left` token.
 *
 * @param this
 *   Context.
 * @param left
 *   Left token.
 * @param right
 *   Right token.
 * @returns
 *   Nothing.
 */
export type OnExitError = (
  this: Omit<CompileContext, 'sliceSerialize'>,
  left: Token,
  right: Token
) => undefined

/**
 * Configuration.
 */
export interface Options extends ParseOptions {
  /**
   * Sink that receives parse diagnostics (such as unclosed code fences).
   *
   * Diagnostics are optional; when omitted (or `null`/`undefined`), no
   * diagnostics are produced. Pass an array to collect them, or a function
   * that is called for each one. Diagnostics never change the resulting
   * syntax tree.
   */
  diagnostics?: Diagnostics | null | undefined

  /**
   * Extensions for this utility to change how tokens are turned into a tree.
   */
  mdastExtensions?: Array<Extension | Array<Extension>> | null | undefined
}

/**
 * Open token on the stack,
 * with an optional error handler for when that token isn’t closed properly.
 */
export type TokenTuple = [token: Token, onError: OnEnterError | undefined]

/**
 * Extra transform, to change the AST afterwards.
 *
 * @param tree
 *   Tree to transform.
 * @returns
 *   New tree or nothing (in which case the current tree is used).
 */
export type Transform = (tree: Root) => Root | null | undefined | void
