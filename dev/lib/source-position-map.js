/**
 * @import {Node, Point, Position} from 'unist'
 * @import {Encoding, Value} from 'micromark-util-types'
 * @import {SourcePositionMap} from './types.js'
 */

/**
 * Create a read-only map between the offsets of positions in an mdast tree
 * and the original markdown document.
 *
 * Positions produced by `micromark` (and so by `mdast-util-from-markdown`)
 * count in UTF-16 code units, just like `string#indexOf` and `string#length`.
 * There are two things to watch out for when slicing the *original*
 * document:
 *
 * *   a carriage return + line feed (`\r\n`, CRLF) is a single line ending,
 *     yet it spans *two* UTF-16 code units.
 *     micromark advances offsets by two over CRLF and by one over a lone
 *     carriage return (`\r`, CR), so offsets already line up with the
 *     indexes of the original document; line endings are never counted
 *     twice.
 * *   a character outside the BMP (such as 😀) is encoded as a surrogate
 *     pair: two UTF-16 code units, but four UTF-8 bytes.
 *
 * This map turns the offsets of unist points into explicit units: indexes
 * into the (decoded) source string (`toOffset`), byte offsets into the
 * source when it is (or would be) UTF-8 encoded (`toByteOffset`), and it can
 * slice the original document for a node or position (`slice`).
 *
 * The map is read-only: it does not change the tree, its positions, or the
 * given document.
 *
 * @param {Value} value
 *   Original markdown document (the same value passed to `fromMarkdown`).
 * @param {Encoding | null | undefined} [encoding]
 *   Character encoding for when `value` is a typed array (optional).
 * @returns {SourcePositionMap}
 *   Read-only map between mdast offsets and the original document.
 */
export function createSourcePositionMap(value, encoding) {
  const source =
    typeof value === 'string'
      ? value
      : new TextDecoder(encoding || undefined).decode(value)

  // Micromark skips a leading byte order mark; offsets start after it.
  const start = source.codePointAt(0) === 0xfe_ff ? 1 : 0
  const end = source.length - start

  /**
   * Lazy cumulative table: `utf8[i]` is the UTF-8 byte offset that UTF-16
   * code unit `i` starts at (and `utf8[source.length]` is the byte length).
   *
   * @type {Array<number> | undefined}
   */
  let utf8

  return {source, toByteOffset, toOffset, slice}

  /**
   * Map an mdast point (or its offset) to the start of the UTF-8 byte
   * sequence that represents the same character.
   *
   * @param {Point | number} place
   *   Point or offset in UTF-16 code units.
   * @returns {number}
   *   Byte offset in the UTF-8 encoded document.
   */
  function toByteOffset(place) {
    return utf8Index(toOffset(place))
  }

  /**
   * Map an mdast point (or its offset) to the index of the same character
   * in the original document.
   *
   * @param {Point | number} place
   *   Point or offset in UTF-16 code units.
   * @returns {number}
   *   Index in the (decoded) source string.
   */
  function toOffset(place) {
    const offset =
      typeof place === 'number' ? place : (place.offset ?? undefined)

    if (offset === undefined || offset < 0 || offset > end) {
      throw new RangeError(
        'Unexpected offset `' +
          String(offset) +
          '`, expected an offset between `0` and `' +
          end +
          '`'
      )
    }

    return offset + start
  }

  /**
   * Slice the original document for a node or position.
   *
   * Line endings are taken as they are in the source, so a CRLF is returned
   * as `\r\n` (not split or counted twice), and characters that use
   * surrogate pairs stay intact.
   *
   * @param {Node | Position} node
   *   Node or position.
   * @returns {string}
   *   Slice of the original document.
   */
  function slice(node) {
    /** @type {Position | undefined} */
    const position =
      'start' in node ? node : /** @type {Node} */ (node).position
    assertPosition(position)
    return source.slice(toOffset(position.start), toOffset(position.end))
  }

  /**
   * Get a UTF-8 byte offset from a (valid) source string index.
   *
   * @param {number} index
   *   Index in the source string.
   * @returns {number}
   *   Byte offset.
   */
  function utf8Index(index) {
    if (!utf8) {
      /** @type {Array<number>} */
      utf8 = []
      let total = 0
      let codeUnit = 0

      while (codeUnit < source.length) {
        const codePoint = source.codePointAt(codeUnit) ?? 0
        /** @type {number} */
        const size =
          codePoint > 65_535
            ? 4 // Full code point (surrogate pair): 4 bytes.
            : codePoint < 128
              ? 1
              : codePoint < 2048
                ? 2
                : 3

        // `utf8[i]` is the byte offset of UTF-16 unit `i`. The low unit of
        // a surrogate pair maps to the start of the same bytes as the high
        // unit, so both units are recorded before moving past the pair.
        if (size === 4) {
          utf8.push(total, total)
          codeUnit += 2
        } else {
          utf8.push(total)
          codeUnit++
        }

        total += size
      }

      utf8.push(total)
    }

    return utf8[index]
  }
}

/**
 * @param {Position | undefined} position
 * @returns {asserts position is Position}
 */
function assertPosition(position) {
  if (!position || !position.start || !position.end) {
    throw new TypeError('Expected a node or position with a `position`')
  }
}
