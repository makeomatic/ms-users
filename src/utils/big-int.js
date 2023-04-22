const ZERO = BigInt(0);

function bigIntComparer(a, b) {
  const diff = BigInt(a) - BigInt(b);

  if (diff === ZERO) {
    return 0;
  }

  return diff < ZERO ? -1 : 1;
}

module.exports = {
  bigIntComparerAsc: bigIntComparer,
  bigIntComparerDesc: (a, b) => bigIntComparer(b, a),
};
