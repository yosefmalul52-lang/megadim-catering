/**
 * Public read-only media Worker for Megadim R2 bucket.
 * Binding: MEDIA_BUCKET -> megadim-media-prod
 * Allows GET/HEAD only. No LIST, no writes from the internet.
 */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, If-None-Match, Range',
    'Access-Control-Expose-Headers': 'ETag, Content-Length, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const method = request.method.toUpperCase();
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (method !== 'GET' && method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store', ...corsHeaders() },
      });
    }

    const url = new URL(request.url);
    let key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (!key || key.endsWith('/')) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store', ...corsHeaders() },
      });
    }
    if (key.includes('\\') || key.split('/').some((p) => !p || p === '.' || p === '..')) {
      return new Response('Bad Request', {
        status: 400,
        headers: { 'Cache-Control': 'no-store', ...corsHeaders() },
      });
    }

    const object = await env.MEDIA_BUCKET.get(key);
    if (!object) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store', ...corsHeaders() },
      });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
    for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);

    const inm = request.headers.get('If-None-Match');
    if (inm && inm === object.httpEtag) {
      return new Response(null, { status: 304, headers });
    }

    if (method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }
    return new Response(object.body, { status: 200, headers });
  },
};
