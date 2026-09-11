/** 8 characters, without the glyphs that are easy to misread (0/O, 1/I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class ReferralCode {
  private constructor(readonly value: string) {}

  static generate(random: () => number = Math.random): ReferralCode {
    let out = '';
    for (let i = 0; i < 8; i++) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
    return new ReferralCode(out);
  }

  static parse(raw: string): ReferralCode | undefined {
    const value = raw.trim().toUpperCase();
    return /^[A-Z2-9]{8}$/.test(value) && ![...value].some((c) => !ALPHABET.includes(c))
      ? new ReferralCode(value)
      : undefined;
  }
}
