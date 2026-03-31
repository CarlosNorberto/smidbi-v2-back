async function handleUnknown({ entities }) {
  return {
    out_of_scope: true,
    intent_detected: entities?.intent || null
  };
}

module.exports = handleUnknown;