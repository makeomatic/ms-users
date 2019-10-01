describe('#sliding-window-limiter', function suite() {
  describe('lua param validation', function luaSuite() {
    it('validates key');
    it('validates limit');
    it('validates interval');
  });

  it('inserts zset record');
  it('sets key ttl');
  it('cancel token');
  it('record count drops on time change');
});
