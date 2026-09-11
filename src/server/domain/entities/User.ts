export type UserStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'DELETED';
export type UserRole = 'USER' | 'ADMIN';
export type UserPlan = 'FREE' | 'PAID';
export type AuthProvider = 'PASSWORD' | 'GOOGLE' | 'FACEBOOK' | 'APPLE';

/** Domain entity — no Prisma types cross this line. */
export interface User {
  id: string;
  email: string;
  emailVerifiedAt?: Date;
  passwordHash?: string;
  name: string;
  phoneE164?: string;
  phoneCountry?: string;
  countryCode: string;
  language: string;
  status: UserStatus;
  role: UserRole;
  plan: UserPlan;
  referralCode: string;
  referredById?: string;
  termsAcceptedAt?: Date;
  marketingOptIn: boolean;
  blockedReason?: string;
  createdAt: Date;
}

/** A blocked, deleted or pending-with-verification-required account cannot sign in. */
export function canAuthenticate(user: User, requireVerification: boolean): boolean {
  if (user.status === 'BLOCKED' || user.status === 'DELETED') return false;
  if (requireVerification && !user.emailVerifiedAt) return false;
  return true;
}

export function isAdmin(user: User): boolean {
  return user.role === 'ADMIN';
}
