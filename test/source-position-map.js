/**
 * @import {Nodes, Parent, Root} from 'mdast'
 * @import {Point} from 'unist'
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {createSourcePositionMap, fromMarkdown} from 'mdast-util-from-markdown'

const encoder = new TextEncoder()

/**
 * Decode a UTF-8 byte range of a document, the byte-based counterpart of
 * `string#slice`.
 *
 * @param {string} document
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
function byteSlice(document, start, end) {
  return new TextDecoder().decode(encoder.encode(document).subarray(start, end))
}

/**
 * @param {string} value
 * @returns {number}
 */
function bytes(value) {
  return encoder.encode(value).length
}

/**
 * Get the position of a node, asserting it is defined.
 *
 * @param {Nodes | Root} node
 */
function position(node) {
  assert.ok(node.position)
  return node.position
}

/**
 * Walk every node in a tree.
 *
 * @param {Root} tree
 * @returns {Array<Nodes>}
 */
function walk(tree) {
  /** @type {Array<Nodes>} */
  const nodes = []
  /** @param {Nodes} node */
  function visit(node) {
    nodes.push(node)
    if ('children' in node) visitChildren(node)
  }

  /** @param {Parent} node */
  function visitChildren(node) {
    for (const child of node.children) visit(child)
  }

  visitChildren(tree)
  return nodes
}

test('createSourcePositionMap', async function (t) {
  await t.test('should expose the public api', async function () {
    assert.deepEqual(Object.keys(createSourcePositionMap('')).sort(), [
      'slice',
      'source',
      'toByteOffset',
      'toOffset'
    ])
  })

  await t.test(
    'should map a node on two CRLF lines with Chinese and an emoji',
    function () {
      const document = '你好，世界\r\n😀 表情'
      const tree = fromMarkdown(document)
      const map = createSourcePositionMap(document)
      const paragraph = /** @type {Parent} */ (tree.children[0])
      const text = /** @type {Extract<Nodes, {value: string}>} */ (
        paragraph.children[0]
      )

      // 5 Chinese characters, then one CRLF line ending (2 units).
      assert.deepEqual(position(text), {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 2, column: 6, offset: 12}
      })

      // Offsets are UTF-16 indexes into the original document.
      assert.equal(map.toOffset(position(text).start), 0)
      assert.equal(map.toOffset(position(text).end), document.length)
      assert.equal(map.toOffset(0), 0)
      assert.equal(map.toOffset(12), 12)

      // 5 Chinese characters (3 bytes each) + CRLF (2) + emoji (4) +
      // space (1) + 2 Chinese characters (6).
      assert.equal(map.toByteOffset(position(text).start), 0)
      assert.equal(map.toByteOffset(position(text).end), 28)
      assert.equal(bytes(document), 28)

      // Node start/end slice the original document exactly.
      assert.equal(map.slice(text), document)
      assert.equal(map.slice(paragraph), document)
      assert.equal(map.slice(tree), document)
      assert.equal(
        byteSlice(
          document,
          map.toByteOffset(position(text).start),
          map.toByteOffset(position(text).end)
        ),
        document
      )
    }
  )

  await t.test('should not double count CRLF line endings', function () {
    const document = '一\r\n二\r\n😀'
    const tree = fromMarkdown(document)
    const map = createSourcePositionMap(document)

    assert.equal(document.length, 8)
    assert.equal(bytes(document), 14)

    /** @type {Array<string>} */
    const slices = []
    /** @type {Array<boolean>} */
    const rounded = []
    /** @type {Array<number>} */
    const byteSpans = []

    for (const node of walk(tree)) {
      const start = map.toOffset(position(node).start)
      const codePoint = document.codePointAt(start) || 0
      slices.push(map.slice(node))
      rounded.push(codePoint >= 0xdc_00 && codePoint <= 0xdf_ff)
      byteSpans.push(
        map.toByteOffset(position(node).end) -
          map.toByteOffset(position(node).start)
      )
    }

    // Every node slice equals the same indexes taken from the document.
    assert.deepEqual(
      slices,
      walk(tree).map(function (node) {
        return document.slice(
          map.toOffset(position(node).start),
          map.toOffset(position(node).end)
        )
      })
    )
    // No boundary lands on a low surrogate (surrogate pairs stay whole).
    assert.deepEqual(
      rounded,
      rounded.map(() => false)
    )
    // Each node’s start byte offset plus its byte length reaches its end.
    assert.deepEqual(
      byteSpans,
      slices.map(function (slice) {
        return bytes(slice)
      })
    )

    // Offset 1 (`\r`) to offset 3 (`二`) spans exactly the two CRLF bytes,
    // not one (CR collapsed) or three (double counted).
    assert.equal(map.toOffset(3) - map.toOffset(1), 2)
    assert.equal(map.toByteOffset(3) - map.toByteOffset(1), 2)
    // The emoji offset starts at 6, its bytes start at 10.
    assert.equal(map.toOffset(6), 6)
    assert.equal(map.toByteOffset(6), 10)
  })

  await t.test(
    'should map inline content spanning a CRLF (emphasis)',
    function () {
      const document = '*中文\r\n😀*'
      const tree = fromMarkdown(document)
      const map = createSourcePositionMap(document)
      const emphasis = /** @type {Extract<Nodes, {type: 'emphasis'}>} */ (
        /** @type {Parent} */ (tree.children[0]).children[0]
      )

      assert.equal(emphasis.type, 'emphasis')
      assert.equal(map.slice(emphasis), document)
      assert.equal(map.toByteOffset(position(emphasis).end), bytes(document))
    }
  )

  await t.test('should handle LF line endings (one unit each)', function () {
    const document = 'a\nb'
    const tree = fromMarkdown(document)
    const map = createSourcePositionMap(document)
    const paragraph = tree.children[0]

    assert.equal(position(paragraph).end.offset, 3)
    assert.equal(map.toOffset(position(paragraph).end), 3)
    assert.equal(map.toByteOffset(position(paragraph).end), 3)
    assert.equal(map.slice(paragraph), 'a\nb')

    // A lone LF advances offsets by a single unit.
    assert.equal(map.toOffset(2) - map.toOffset(1), 1)
  })

  await t.test('should keep a lone CR when slicing the source', function () {
    const document = 'a\rb'
    const tree = fromMarkdown(document)
    const map = createSourcePositionMap(document)
    const paragraph = tree.children[0]

    assert.equal(position(paragraph).end.offset, 3)
    assert.equal(map.slice(paragraph), 'a\rb')
    assert.equal(map.toByteOffset(position(paragraph).end), 3)
  })

  await t.test(
    'should handle an empty document at the unit boundary',
    function () {
      const document = ''
      const tree = fromMarkdown(document)
      const map = createSourcePositionMap(document)

      assert.equal(map.source, '')
      assert.equal(map.toOffset(position(tree).start), 0)
      assert.equal(map.toOffset(position(tree).end), 0)
      assert.equal(map.toByteOffset(0), 0)
      assert.equal(map.slice(tree), '')
    }
  )

  await t.test('should handle an emoji at the end boundary', function () {
    const document = 'a😀b'
    const tree = fromMarkdown(document)
    const map = createSourcePositionMap(document)
    const paragraph = /** @type {Parent} */ (tree.children[0])
    const text = /** @type {Extract<Nodes, {value: string}>} */ (
      paragraph.children[0]
    )

    // `a`, high surrogate, low surrogate, `b`.
    assert.equal(position(text).end.offset, 4)
    assert.equal(map.toOffset(position(text).end), 4)
    assert.equal(map.toByteOffset(position(text).end), 6)
    assert.equal(map.slice(text), 'a😀b')
    // The high and low surrogate map to the same byte start and the
    // boundary never lands inside the 4-byte sequence.
    assert.equal(map.toByteOffset(1), 1)
    assert.equal(map.toByteOffset(2), 1)
    assert.equal(map.toByteOffset(3), 5)
  })

  await t.test('should account for a leading byte order mark', function () {
    const document = '﻿x\r\ny'
    const tree = fromMarkdown(document)
    const map = createSourcePositionMap(document)

    // Offsets start after the BOM, so mdast offset 0 is source index 1 and
    // byte offset 3.
    assert.equal(map.toOffset(0), 1)
    assert.equal(map.toByteOffset(0), 3)
    assert.equal(map.slice(tree), 'x\r\ny')
    assert.equal(map.toByteOffset(position(tree).end), bytes(document))
  })

  await t.test('should map a typed array document to UTF-8 bytes', function () {
    const document = '第一行\r\n😀'
    const value = encoder.encode(document)
    const tree = fromMarkdown(value)
    const map = createSourcePositionMap(value)
    const paragraph = /** @type {Parent} */ (tree.children[0])
    const text = /** @type {Extract<Nodes, {value: string}>} */ (
      paragraph.children[0]
    )

    assert.equal(map.source, document)
    assert.equal(map.slice(text), document)
    assert.equal(map.toByteOffset(position(text).end), value.length)
    assert.equal(
      new TextDecoder().decode(
        value.subarray(
          map.toByteOffset(position(text).start),
          map.toByteOffset(position(text).end)
        )
      ),
      document
    )
  })

  await t.test('should accept points and numbers', function () {
    const map = createSourcePositionMap('你\r\n😀')

    assert.equal(map.toOffset(0), 0)
    assert.equal(
      map.toOffset(/** @type {Point} */ ({line: 1, column: 1, offset: 0})),
      0
    )
  })

  await t.test('should throw on offsets outside the document', function () {
    const map = createSourcePositionMap('a\nb')

    assert.throws(function () {
      map.toOffset(-1)
    }, /Unexpected offset/)
    assert.throws(function () {
      map.toOffset(4)
    }, /Unexpected offset/)
    assert.throws(function () {
      map.toByteOffset(-1)
    }, /Unexpected offset/)
  })

  await t.test('should not change the tree or the document', function () {
    const document = '中文\r\n*😀*'
    const tree = fromMarkdown(document)
    const before = JSON.stringify(tree)
    const map = createSourcePositionMap(document)

    /** @type {Array<number | string>} */
    const seen = []

    for (const node of walk(tree)) {
      // Exercise every conversion; the values only have to be computed.
      seen.push(
        map.toOffset(position(node).start),
        map.toByteOffset(position(node).end),
        map.slice(node)
      )
    }

    assert.ok(seen.length > 0)

    assert.equal(JSON.stringify(tree), before)
    assert.equal(map.source, document)
  })
})
