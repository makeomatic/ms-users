function bigIntComparer(a, b) {
  const sign = BigInt(a) - BigInt(b);

  if (sign === 0) {
    return 0;
  }

  return sign < 0 ? -1 : 1;
}

module.exports = {
  bigIntComparerAsc: bigIntComparer,
  bigIntComparerDesc: (a, b) => bigIntComparer(b, a),
};
