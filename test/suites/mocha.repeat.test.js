const { assert } = require('chai');

describe('block', () => {
  before(() => console.debug('before block'));
  after(() => console.debug('after block'));
  describe('subBlock', function subBlock() {
    this.retries(3);

    beforeEach(() => console.debug('beforeEach block'));
    after(() => console.debug('afterEach block'));

    let count = 0;
    let count2 = 0;

    it('fail', () => {
      console.debug('fail');
      count += 1;
      if (count < 3) {
        assert.strictEqual(1, 2);
      }
      assert.strictEqual(1, 1);
    });

    it('failAsync', async () => {
      console.debug('fail');
      count2 += 1;
      if (count2 < 3) {
        assert.strictEqual(1, 2);
      }
      assert.strictEqual(1, 1);
    });
  });
});
