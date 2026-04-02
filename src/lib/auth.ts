import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { libLogger } from '@/lib/debug'

const log = libLogger('auth')

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        log.info('Login attempt for:', credentials?.email)
        if (!credentials?.email || !credentials?.password) {
          log.warn('Missing credentials')
          return null
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user || !user.isActive) {
          log.warn('User not found or inactive:', credentials.email)
          return null
        }
        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) {
          log.warn('Invalid password for:', credentials.email)
          return null
        }
        log.info('Login successful:', credentials.email, 'role:', user.role)
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          initials: user.initials,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.initials = (user as any).initials
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.initials = token.initials as string
      }
      return session
    },
  },
}
