import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    // If authenticated and visiting /login, redirect to /dashboard
    if (pathname.startsWith('/login')) {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      })
      if (token) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    return NextResponse.next()
  }

  // Require authentication for all other routes
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
