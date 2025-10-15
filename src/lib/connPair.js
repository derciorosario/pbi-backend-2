// src/lib/connPair.js
exports.normalizePair = (id1, id2) => {
  return String(id1) < String(id2) ? [String(id1), String(id2)] : [String(id2), String(id1)];
};
