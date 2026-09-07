/** A skin the user saved to their account (follows them across devices). */
export interface UserSkin {
  id: string;
  userId: string;
  /** Client-side skin id, stable across saves. */
  skinId: string;
  name: string;
  data: unknown;
  isDefault: boolean;
  updatedAt: Date;
}
