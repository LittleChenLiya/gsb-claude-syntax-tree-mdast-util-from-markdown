/**
 * @import {Encoding, Value} from 'micromark-util-types'
 */

import {ok as assert} from 'devlop'

// Note: this is the code that `micromark` strips when it starts a document.
const byteOrderMarker = 0xfe_ff

/**
 * Read-only map from mdast `offset`s back into the original markdown source.
 *
 * Offsets on mdast nodes (`position.start.offset`, `position.end.offset`)
 * count UTF-16 code units in the original document: a CRLF line ending
 * counts as two units (its `\r` and `\n` are counted once, together), a tab
 * counts as one unit, and an astral character (surrogate pair) counts as two
 * units.
 * The only difference between an mdast `offset` and an index into the
 * original string is a leading byte order mark (U+FEFF), which is not
 * represented in offsets.
 *
 * @typedef {object} OffsetMap
 *   Read-only map from mdast offsets into the original source.
 * @property {(offset: number) => number} toByteOffset
 *   Map an mdast `offset` to a byte offset in the UTF-8 encoding of the
 *   original value.
 * @property {(offset: number) => number} toUtf16Index
 *   Map an mdast `offset` to a UTF-16 code unit index in the original value.
 */

/**
 * Create a read-only map from mdast `offset`s (as found on nodes from
 * `fromMarkdown` when given the same `value`) back into the original
 * markdown source, in explicit units.
 *
 * The map never changes the tree or the source: it only translates offsets.
 *
 * @param {Value} value
 *   Original markdown, as passed to `fromMarkdown`.
 * @param {Encoding | null | undefined} [encoding]
 *   Character encoding for when `value` is `Buffer` (same meaning as in
 *   `fromMarkdown`).
 * @returns {OffsetMap}
 *   Read-only offset map.
 */
export function createOffsetMap(value, encoding) {
  const document =
    typeof value === 'string'
      ? value
      : new TextDecoder(encoding || undefined).decode(value)
  // `micromark` drops a leading BOM before parsing, so every mdast offset is
  // shifted by one UTF-16 code unit (three UTF-8 bytes) compared to the
  // original value.
  const bom = document.codePointAt(0) === byteOrderMarker ? 1 : 0
  const length = document.length - bom
  // Cumulative UTF-8 byte length of the original value, per UTF-16 index.
  const bytes = new Uint32Array(document.length + 1)
  let index = 0

  while (index < document.length) {
    const codePoint = /** @type {number} */ (document.codePointAt(index))
    const size =
      codePoint < 0x80
        ? 1
        : codePoint < 0x8_00
          ? 2
          : codePoint < 0x1_00_00
            ? 3
            : 4

    if (codePoint < 0x1_00_00) {
      bytes[index + 1] = bytes[index] + size
      index++
    } else {
      // Astral character: a surrogate pair is two UTF-16 code units but one
      // character of four UTF-8 bytes; an offset between the halves of a
      // pair maps to the start of the pair, so the line ending or character
      // is never counted twice.
      bytes[index + 1] = bytes[index]
      bytes[index + 2] = bytes[index] + size
      index += 2
    }
  }

  return Object.freeze({
    toByteOffset,
    toUtf16Index
  })

  /**
   * Map an mdast `offset` to a byte offset in the UTF-8 encoding of the
   * original value.
   *
   * @param {number} offset
   *   mdast offset.
   * @returns {number}
   *   UTF-8 byte offset in the original value.
   */
  function toByteOffset(offset) {
    assertOffset(offset)
    return bytes[offset + bom]
  }

  /**
   * Map an mdast `offset` to a UTF-16 code unit index in the original
   * value.
   *
   * @param {number} offset
   *   mdast offset.
   * @returns {number}
   *   UTF-16 code unit index in the original value.
   */
  function toUtf16Index(offset) {
    assertOffset(offset)
    return offset + bom
  }

  /**
   * @param {number} offset
   *   mdast offset.
   * @returns {undefined}
   *   Nothing.
   */
  function assertOffset(offset) {
    assert(Number.isSafeInteger(offset), 'expected `offset` to be an integer')
    assert(offset >= 0, 'expected `offset` to be greater than or equal to 0')
    assert(
      offset <= length,
      'expected `offset` to be less than or equal to the document length'
    )
  }
}
