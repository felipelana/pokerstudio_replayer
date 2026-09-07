export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  twoFactorAt?: Date;
  revokedAt?: Date;
  ip?: string;
  userAgent?: string;
}

export function isSessionUsable(session: Session, now: Date): boolean {
  return !session.revokedAt && session.expiresAt > now;
}
