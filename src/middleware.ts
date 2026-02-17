import { NextRequest, NextResponse } from 'next/server';

const CRON_ENDPOINT_PATH = '/api/cron/fetch-feeds';
const AUTH_REALM = 'RSS Mix';

function unauthorizedResponse() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${AUTH_REALM}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function decodeBasicToken(token: string): string | null {
  try {
    return atob(token);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cron keeps its own bearer-token auth and should remain callable by Vercel.
  if (pathname.startsWith(CRON_ENDPOINT_PATH)) {
    return NextResponse.next();
  }

  const expectedUser = process.env.APP_AUTH_USER;
  const expectedPass = process.env.APP_AUTH_PASS;

  if (!expectedUser || !expectedPass) {
    return new NextResponse('Authentication is not configured', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorizedResponse();
  }

  const encodedToken = authHeader.slice(6).trim();
  const decodedCredentials = decodeBasicToken(encodedToken);

  if (!decodedCredentials) {
    return unauthorizedResponse();
  }

  const separatorIndex = decodedCredentials.indexOf(':');
  if (separatorIndex < 0) {
    return unauthorizedResponse();
  }

  const providedUser = decodedCredentials.slice(0, separatorIndex);
  const providedPass = decodedCredentials.slice(separatorIndex + 1);

  if (providedUser !== expectedUser || providedPass !== expectedPass) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};
