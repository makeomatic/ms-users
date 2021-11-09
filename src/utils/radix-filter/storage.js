// possible replacement https://yomguithereal.github.io/mnemonist/trie-map
// or any Trie structure
const RadixTree = require('radix-trie-js');

/**
 * Sample radix tree storage
 */
class RadixStorage {
  constructor() {
    this.tree = new RadixTree();
  }

  /**
   *
   * @param {string} node
   * @param {any} value
   */
  add(node, value) {
    this.tree.add(node, value);
  }

  length() {
    return Array.from(this.tree.entries()).length;
  }

  /**
   *
   * @param {string} prefix
   * @returns {Generator<any, [string, object], any>}
   */
  findGenerator(prefix) {
    return this.tree.fuzzyGet(prefix);
  }
}

module.exports = {
  RadixStorage,
};
