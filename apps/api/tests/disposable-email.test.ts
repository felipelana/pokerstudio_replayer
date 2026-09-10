import { describe, expect, it } from 'vitest';
import { DISPOSABLE_DOMAIN_COUNT, domainOf, isDisposableEmail } from '@pokerstudio/shared';
import { Email } from '../src/domain/value-objects/Email.js';

/**
 * The rule at the door: a throwaway address is refused, and a real one is not.
 *
 * The second half matters more than the first. A list like this earns its place
 * only if it never turns away someone who came to use the product, so the
 * ordinary addresses are tested as carefully as the disposable ones.
 */
describe('disposable addresses', () => {
  it('knows the services people actually reach for', () => {
    expect(DISPOSABLE_DOMAIN_COUNT).toBeGreaterThan(100);
    for (const address of [
      'a@mailinator.com',
      'b@yopmail.com',
      'c@guerrillamail.com',
      'd@10minutemail.com',
      'e@temp-mail.org',
      'f@emailtemporario.com.br',
      'g@1secmail.com',
    ]) {
      expect(isDisposableEmail(address), address).toBe(true);
    }
  });

  it('follows a service into its subdomains', () => {
    expect(isDisposableEmail('a@mail.yopmail.com')).toBe(true);
    expect(isDisposableEmail('a@x.y.mailinator.com')).toBe(true);
  });

  it('is not fooled by case or a trailing dot', () => {
    expect(isDisposableEmail('A@MailInator.COM')).toBe(true);
    expect(isDisposableEmail('a@mailinator.com.')).toBe(true);
    expect(domainOf('a@Example.COM.')).toBe('example.com');
  });

  it('lets real addresses through, which is the harder half', () => {
    for (const address of [
      'felipe@gmail.com',
      'felipe@hotmail.com',
      'felipe@outlook.com.br',
      'felipe@pokerstudio.com.br',
      'felipe@uol.com.br',
      'felipe@proton.me',
      'felipe@icloud.com',
      'felipe@empresa.com.br',
      // A name that merely contains a banned word is not a banned domain.
      'felipe@mailinator-consultoria.com.br',
      'temp@empresa.com',
    ]) {
      expect(isDisposableEmail(address), address).toBe(false);
    }
  });

  it('refuses at the door, with a reason a reader can act on', () => {
    const bad = Email.create('jogador@mailinator.com');
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.code).toBe('disposable_email');
      expect(bad.error.status).toBe(422);
      expect(bad.error.message).toMatch(/tempor/i);
    }

    const good = Email.create('Jogador@Gmail.com');
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.value.value).toBe('jogador@gmail.com');
  });
});
