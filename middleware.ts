import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 1) Refreshes the Supabase auth session on every request (standard @supabase/ssr pattern).
 * 2) SECURITY-TODO M-4: emits a nonce-based CSP. Shipped as **Report-Only** for now — it observes
 *    violations in the browser console WITHOUT blocking, because enforcing needs live testing of
 *    Monaco (CDN + eval + workers) and the preview iframe, which can't be automated. To enforce once
 *    verified clean, rename the header to "Content-Security-Policy".
 */

function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    // Monaco loads from jsdelivr and uses eval; Next + our theme script use the nonce.
    `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://cdn.jsdelivr.net`,
    `worker-src 'self' blob:`,
    // next/font + Monaco inject inline styles (style nonces are impractical).
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    // browser Supabase client (REST + realtime) + same-origin SSE.
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
    `frame-src 'self' blob: data:`, // the preview iframe (srcdoc)
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the session so it refreshes if needed.
  await supabase.auth.getUser();

  response.headers.set("Content-Security-Policy-Report-Only", buildCsp(nonce));
  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
