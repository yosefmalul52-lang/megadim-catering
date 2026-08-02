'use strict';
/**
 * Abort if Mongo URI looks like production Atlas / live cluster.
 * Bypass only with explicit --allow-production (never for routine local work).
 */
function isProductionMongoUri(uri) {
  if (!uri) return false;
  const u = String(uri).toLowerCase();
  const prodMarkers = [
    'mongodb.net',
    'mongodb+srv://',
    'magadimcluster',
    'megadimcluster',
    'amazonaws.com',
    'cosmos.azure.com',
  ];
  // Local / memory / docker exceptions
  if (
    u.includes('127.0.0.1') ||
    u.includes('localhost') ||
    u.includes('0.0.0.0') ||
    u.includes('memory')
  ) {
    return false;
  }
  return prodMarkers.some((m) => u.includes(m));
}

function assertSafeMongoUri(uri, { allowProduction = false, label = 'operation' } = {}) {
  if (!uri) {
    throw new Error(`[safety] Missing Mongo URI for ${label}`);
  }
  if (isProductionMongoUri(uri) && !allowProduction) {
    throw new Error(
      `[safety] Refusing ${label} against production-like Mongo host. ` +
        `Use a local/test database, or pass --allow-production only with explicit human approval.`
    );
  }
}

module.exports = { isProductionMongoUri, assertSafeMongoUri };
