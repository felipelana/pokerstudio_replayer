/**
 * Addresses that exist to be thrown away.
 *
 * A throwaway address defeats everything the account is for: the review that
 * survives a cleared browser, the link a coach opens, the way back in when a
 * password is lost. Someone who signs up with one has no account tomorrow, and
 * the support message that follows is ours to answer.
 *
 * This is a list, and a list is never finished. New services appear weekly and
 * the well-known ones own hundreds of domains each. What is here covers the
 * services people actually reach for; it is meant to be added to, and it is
 * deliberately conservative, because refusing a real address is worse than
 * letting a throwaway through.
 */

/** The services people actually use, and the aliases they answer on. */
const DISPOSABLE_DOMAINS = new Set([
  // 10 minute mail and its many faces
  '10minutemail.com', '10minutemail.net', '10minutemail.org', '10minemail.com',
  '20minutemail.com', '30minutemail.com', '10minutesmail.com', '10minutemail.co.uk',
  // Mailinator, the oldest of them
  'mailinator.com', 'mailinator.net', 'mailinator2.com', 'mailinator.org',
  'sogetthis.com', 'spamherelots.com', 'suremail.info', 'binkmail.com',
  'bobmail.info', 'chammy.info', 'devnullmail.com', 'letthemeatspam.com',
  'mailin8r.com', 'notmailinator.com', 'reallymymail.com', 'thisisnotmyrealemail.com',
  // Guerrilla Mail
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamailblock.com', 'grr.la', 'sharklasers.com',
  'spam4.me', 'pokemail.net',
  // Temp Mail and relatives
  'temp-mail.org', 'temp-mail.io', 'tempmail.com', 'tempmail.net', 'tempmailo.com',
  'tempail.com', 'tempr.email', 'tempmailer.com', 'tempinbox.com', 'tempmail.plus',
  'tmpmail.org', 'tmpmail.net', 'tmail.ws', 'tmails.net',
  // YOPmail
  'yopmail.com', 'yopmail.net', 'yopmail.fr', 'cool.fr.nf', 'jetable.fr.nf',
  'nospam.ze.tc', 'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf',
  'moncourrier.fr.nf', 'monemail.fr.nf', 'monmail.fr.nf',
  // Throwaway and burner services
  'throwawaymail.com', 'trashmail.com', 'trashmail.de', 'trashmail.net',
  'trash-mail.com', 'trash-mail.de', 'wegwerfmail.de', 'wegwerfmail.net',
  'wegwerfmail.org', 'mytrashmail.com', 'kurzepost.de', 'objectmail.com',
  'proxymail.eu', 'rcpt.at', 'discard.email', 'discardmail.com', 'discardmail.de',
  'spambog.com', 'spambog.de', 'spambog.ru', 'spamgourmet.com',
  // Mailcatcher style, and the ones behind browser extensions
  'maildrop.cc', 'mailnesia.com', 'mailcatch.com', 'mailnull.com', 'mail-temporaire.fr',
  'getnada.com', 'nada.email', 'inboxkitten.com', 'emailondeck.com',
  'fakeinbox.com', 'fakemailgenerator.com', 'fake-email.com', 'dispostable.com',
  'mohmal.com', 'moakt.com', 'moakt.ws', 'tempmailaddress.com',
  'burnermail.io', 'harakirimail.com', 'mailexpire.com', 'meltmail.com',
  'anonbox.net', 'spamdecoy.net', 'incognitomail.com', 'mailscrap.com',
  'mintemail.com', 'mailforspam.com', 'e4ward.com', 'emltmp.com',
  '1secmail.com', '1secmail.net', '1secmail.org', 'esiix.com', 'wwjmp.com',
  'xojxe.com', 'yoggm.com', 'vjuum.com', 'laafd.com', 'txcct.com',
  'byom.de', 'mailbox52.ga', 'linshiyouxiang.net', 'luxusmail.org',
  'mail.tm', 'mail.gw', 'dropmail.me', 'minuteinbox.com', 'emailfake.com',
  'generator.email', 'internxt.com', 'altmails.com', 'edu.auction',
  // Portuguese and Brazilian services
  'emailtemporario.com.br', 'emailtemporario.net', 'descartavel.com.br',
  'mailtemporario.com.br',
]);

/**
 * The domain an address belongs to, normalised.
 *
 * Case is folded, and a trailing dot is dropped: `a@Example.COM.` and
 * `a@example.com` are the same mailbox, and a list that missed that would be
 * trivial to walk past.
 */
export function domainOf(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0) return '';
  return email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
}

/**
 * Is this address from a service that exists to be thrown away?
 *
 * Subdomains count: `x@mail.yopmail.com` is YOPmail. The test walks up the
 * labels rather than matching the whole string, so one entry covers a service
 * that hands out subdomains by the thousand.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = domainOf(email);
  if (!domain) return false;
  const labels = domain.split('.');
  for (let i = 0; i < labels.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}

/** How many services the list currently knows. Used by the test, and by nobody else. */
export const DISPOSABLE_DOMAIN_COUNT = DISPOSABLE_DOMAINS.size;
