/**
 * Identity provider port. The use case knows nothing about Google: swapping or
 * adding a provider never touches `domain`.
 */
export interface OAuthStart {
  authorizationUrl: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface OAuthProfile {
  /** Stable id at the provider (`sub`). */
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string;
  /** BCP-47 locale the provider reports, e.g. "pt-BR". */
  locale?: string;
}

export interface OAuthProvider {
  readonly name: 'GOOGLE';
  /** Builds the authorisation URL with PKCE, state and nonce. */
  start(): OAuthStart;
  /**
   * Exchanges the code and validates the identity token: signature against the
   * provider's JWKS, issuer, audience, expiry and the nonce we sent.
   */
  complete(input: { code: string; codeVerifier: string; nonce: string }): Promise<OAuthProfile>;
}
