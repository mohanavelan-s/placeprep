function buildUpdateClause(updates, startIndex = 1) {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);

  if (!entries.length) {
    return {
      clause: '',
      values: [],
    };
  }

  return {
    clause: entries.map(([column], index) => `${column} = $${startIndex + index}`).join(', '),
    values: entries.map(([, value]) => value),
  };
}

module.exports = {
  buildUpdateClause,
};
