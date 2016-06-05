/**
 * Created by Stainwoortsel on 05.06.2016.
 */
/**
 * Is a common method for mapping updateMetadata ops
 * @param operations
 * @param responses
 * @returns {Promise}
 */
module.exports = function mapMetaResponse(operations, responses) {
  let cursor = 0;
  return Promise.map(operations, props => {
    const { $removeOps, $setLength, $incrLength, $incrFields } = props;
    const output = {};

    if ($removeOps > 0) {
      output.$remove = responses[cursor][1];
      cursor++;
    }

    if ($setLength > 0) {
      output.$set = responses[cursor][1];
      cursor++;
    }

    if ($incrLength > 0) {
      const $incrResponse = output.$incr = {};
      $incrFields.forEach(fieldName => {
        $incrResponse[fieldName] = responses[cursor][1];
        cursor++;
      });
    }

    return output;
  })
    .then(ops => {
      return ops.length > 1 ? ops : ops[0];
    });
};
