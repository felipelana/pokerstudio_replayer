/**
 * Draws the two diagrams the technical documentation needs, straight from what
 * the schema and the source tree actually say. Hand-placed coordinates, so the
 * grid reads as deliberate; the drawing itself is generated so the arithmetic
 * is right.
 */
const fs = require('fs');
const path = require('path');

const OUT = 'C:/LanaReplayer/docs/diagramas';
fs.mkdirSync(OUT, { recursive: true });

const INK = '#14141a';
const MUTED = '#5b5b6b';
const LINE = '#9aa0ad';
const PAPER = '#ffffff';
const ACCENT = '#c81d16';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ------------------------------------------------------------------ */
/* 1. Entidade e relacionamento                                        */
/* ------------------------------------------------------------------ */

const GROUPS = {
  acesso: { label: 'Identidade e acesso', fill: '#eef2fb', stroke: '#b9c6e6' },
  revisao: { label: 'Revisão e avaliação', fill: '#fdeceb', stroke: '#f0b6b2' },
  prefs: { label: 'Preferências do jogador', fill: '#eef7f0', stroke: '#b6d8c1' },
  operacao: { label: 'Produto e operação', fill: '#f6f1fa', stroke: '#cdbede' },
};

/** x, y, w and the fields worth printing. `pk`/`fk` mark the key columns. */
const TABLES = [
  // ---- identidade e acesso
  { id: 'User', g: 'acesso', x: 88, y: 132, w: 236, fields: [
    ['id', 'uuid', 'pk'], ['email', 'citext · único'], ['passwordHash', 'text?'],
    ['name / phoneE164', 'text'], ['countryCode / language', 'char(2) / varchar'],
    ['status / role / plan', 'enum'], ['referralCode', 'varchar(8) · único'],
    ['referredById', 'uuid?', 'fk'], ['termsAcceptedAt', 'timestamptz?'], ['deletedAt', 'timestamptz?'],
  ]},
  { id: 'AuthIdentity', g: 'acesso', x: 88, y: 424, w: 236, fields: [
    ['id', 'uuid', 'pk'], ['userId', 'uuid', 'fk'],
    ['provider', 'GOOGLE | FACEBOOK | APPLE'], ['providerUserId', 'text'],
    ['email / avatarUrl', 'text'], ['lastLoginAt', 'timestamptz?'],
  ]},
  { id: 'Session', g: 'acesso', x: 88, y: 606, w: 236, fields: [
    ['id', 'uuid', 'pk'], ['userId', 'uuid', 'fk'], ['tokenHash', 'text'],
    ['expiresAt / revokedAt', 'timestamptz'], ['twoFactorAt', 'timestamptz?'],
  ]},
  { id: 'TwoFactor', g: 'acesso', x: 88, y: 766, w: 236, fields: [
    ['id', 'uuid', 'pk'], ['userId', 'uuid', 'fk'], ['secretEnc', 'text? · AES-256-GCM'],
    ['confirmedAt / lastUsedStep', 'ts? / bigint?'],
  ]},
  { id: 'RecoveryCode', g: 'acesso', x: 88, y: 904, w: 236, fields: [
    ['id', 'uuid', 'pk'], ['userId', 'uuid', 'fk'], ['codeHash / usedAt', 'text / ts?'],
  ]},
  { id: 'TrustedDevice', g: 'acesso', x: 88, y: 1020, w: 236, fields: [
    ['id', 'uuid', 'pk'], ['userId', 'uuid', 'fk'], ['tokenHash / expiresAt', 'text / ts'],
  ]},
  { id: 'EmailToken', g: 'acesso', x: 344, y: 424, w: 216, fields: [
    ['id', 'uuid', 'pk'], ['userId', 'uuid', 'fk'],
    ['type', 'VERIFY | RESET'], ['tokenHash / expiresAt', 'text / ts'], ['usedAt', 'ts?'],
  ]},
  { id: 'AccessLog', g: 'acesso', x: 344, y: 606, w: 216, fields: [
    ['id', 'bigint', 'pk'], ['userId', 'uuid?', 'fk'], ['event', 'AccessEvent'],
    ['ip / country / device', 'text'], ['detail', 'jsonb?'],
  ]},
  { id: 'LoginAttempt', g: 'acesso', x: 344, y: 766, w: 216, fields: [
    ['key', 'text', 'pk'], ['count / windowStart', 'int / ts'], ['lockedUntil', 'ts?'],
  ]},

  // ---- revisão e avaliação
  { id: 'ReviewSession', g: 'revisao', x: 588, y: 132, w: 250, fields: [
    ['id', 'uuid', 'pk'], ['userId', 'uuid', 'fk'], ['title / sourceFileName', 'text'],
    ['roomDetected', 'text?'], ['handCount', 'int'],
    ['status', 'IN_PROGRESS | COMPLETED'], ['storeHandHistory', 'bool'], ['lastOpenedAt', 'ts'],
  ]},
  { id: 'HandRecord', g: 'revisao', x: 588, y: 404, w: 250, fields: [
    ['id', 'uuid', 'pk'], ['reviewSessionId', 'uuid', 'fk'], ['index', 'int · único por sessão'],
    ['handId', 'text?'], ['rawHistory', 'text? · só com opt-in'],
    ['heroVpip', 'bool? · base da cobertura'], ['result / potWon', 'enum? / numeric?'],
  ]},
  { id: 'ReviewNote', g: 'revisao', x: 588, y: 646, w: 250, fields: [
    ['id', 'uuid', 'pk'], ['handRecordId', 'uuid', 'fk'],
    ['tags / body', 'text[] / text'], ['includeInReport', 'bool'],
    ['legado — anterior a Assessment', ''],
  ]},
  { id: 'CoachInvite', g: 'revisao', x: 900, y: 132, w: 250, fields: [
    ['id', 'uuid', 'pk'], ['reviewSessionId', 'uuid', 'fk'], ['createdById', 'uuid', 'fk'],
    ['coachName', 'varchar(80)'], ['token', 'varchar(64) · único'],
    ['passwordHash', 'text · argon2id'], ['expiresAt / revokedAt', 'ts / ts?'],
    ['claimedByUserId', 'uuid? · fase 2', 'fk'],
  ]},
  { id: 'Assessment', g: 'revisao', x: 900, y: 404, w: 250, fields: [
    ['id', 'uuid', 'pk'], ['reviewSessionId', 'uuid', 'fk'],
    ['role', 'SELF | COACH'], ['userId', 'uuid? · quando SELF', 'fk'],
    ['coachInviteId', 'uuid? · único', 'fk'], ['status', 'NOT_STARTED | IN_PROGRESS | COMPLETED'],
    ['currentHandIndex / Frame', 'int'], ['completedAt', 'ts? · trava a edição'],
  ]},
  { id: 'HandAssessment', g: 'revisao', x: 900, y: 690, w: 250, fields: [
    ['id', 'uuid', 'pk'], ['assessmentId', 'uuid', 'fk'], ['handRecordId', 'uuid', 'fk'],
    ['score', 'int? · 0–100; null ≠ 0'], ['markedOk', 'bool'],
    ['comment / streetComments', 'text? / jsonb?'], ['tags', 'text[]'],
  ]},

  // ---- preferências
  { id: 'UserSkin', g: 'prefs', x: 344, y: 904, w: 216, fields: [
    ['id', 'uuid', 'pk'], ['userId', 'uuid', 'fk'], ['skinId / name', 'text'], ['data', 'jsonb'],
  ]},
  { id: 'RoomNick', g: 'prefs', x: 344, y: 1020, w: 216, fields: [
    ['id', 'uuid', 'pk'], ['userId', 'uuid', 'fk'], ['room / nickname', 'varchar · único por par'],
  ]},

  // ---- produto e operação
  { id: 'Feedback', g: 'operacao', x: 1210, y: 132, w: 230, fields: [
    ['id', 'uuid', 'pk'], ['userId', 'uuid? → User', 'fk'], ['kind / status', 'enum'],
    ['subject', 'varchar(200)'], ['body', 'text · até 1.000'], ['adminNote / appSurface', 'text?'],
  ]},
  { id: 'RubricBand', g: 'operacao', x: 1210, y: 340, w: 230, fields: [
    ['id', 'uuid', 'pk'], ['minScore', 'int · único'], ['maxScore', 'int'],
    ['description', 'varchar(200)'],
  ]},
  { id: 'ShareSettings', g: 'operacao', x: 1210, y: 470, w: 230, fields: [
    ['id', 'int = 1', 'pk'], ['defaultHours', 'int · 24'], ['maxHours', 'int · 168'],
  ]},
  { id: 'Referral', g: 'operacao', x: 1210, y: 580, w: 230, fields: [
    ['id', 'uuid', 'pk'], ['referrerId', 'uuid → User', 'fk'], ['acceptedById', 'uuid? → User', 'fk'],
    ['channel / code', 'enum / text'],
  ]},
  { id: 'UsageEvent', g: 'operacao', x: 1210, y: 710, w: 230, fields: [
    ['id', 'bigint', 'pk'], ['userId', 'uuid? → User', 'fk'], ['anonId', 'text?'],
    ['type / skinId', 'enum / text?'],
  ]},
  { id: 'MetricDaily', g: 'operacao', x: 1210, y: 840, w: 230, fields: [
    ['day + metric', 'pk composta'], ['value', 'int'],
  ]},
  { id: 'EmailOutbox', g: 'operacao', x: 1210, y: 940, w: 230, fields: [
    ['id', 'uuid', 'pk'], ['to / template / locale', 'text'],
    ['status / attempts', 'enum / int'],
  ]},
  { id: 'EmailSettings', g: 'operacao', x: 1210, y: 1060, w: 230, fields: [
    ['id', 'int = 1', 'pk'], ['provider', 'NONE | RESEND | SMTP'], ['secretEnc', 'text? · cifrado'],
  ]},
];

const ROW_H = 17;
const HEAD_H = 26;
const tableHeight = (t) => HEAD_H + t.fields.length * ROW_H + 8;
const byId = Object.fromEntries(TABLES.map((t) => [t.id, t]));

/** Which column a field sits on, so an edge can leave from the right row. */
function fieldY(tableId, name) {
  const t = byId[tableId];
  const i = t.fields.findIndex((f) => f[0].startsWith(name));
  return t.y + HEAD_H + (i < 0 ? 0 : i) * ROW_H + ROW_H / 2 - 2;
}

/**
 * from → to, as an orthogonal run with a labelled cardinality. `side` says
 * which face of each box the line leaves and enters.
 */
const EDGES = [
  { from: ['User', 'id'], to: ['AuthIdentity', 'userId'], card: '1 : N', label: 'provedores ligados', lane: 0 },
  { from: ['User', 'id'], to: ['Session', 'userId'], card: '1 : N', lane: 1 },
  { from: ['User', 'id'], to: ['TwoFactor', 'userId'], card: '1 : N', lane: 2 },
  { from: ['User', 'id'], to: ['RecoveryCode', 'userId'], card: '1 : N', lane: 3 },
  { from: ['User', 'id'], to: ['TrustedDevice', 'userId'], card: '1 : N', lane: 4 },
  { from: ['User', 'id'], to: ['EmailToken', 'userId'], card: '1 : N', right: true },
  { from: ['User', 'id'], to: ['AccessLog', 'userId'], card: '1 : N', right: true },
  { from: ['User', 'id'], to: ['UserSkin', 'userId'], card: '1 : N', right: true },
  { from: ['User', 'id'], to: ['RoomNick', 'userId'], card: '1 : N', right: true },
  { from: ['User', 'id'], to: ['ReviewSession', 'userId'], card: '1 : N', label: 'sessões importadas', right: true },
  { from: ['ReviewSession', 'id'], to: ['HandRecord', 'reviewSessionId'], card: '1 : N', label: 'a review é a sessão inteira' },
  { from: ['HandRecord', 'id'], to: ['ReviewNote', 'handRecordId'], card: '1 : N' },
  { from: ['ReviewSession', 'id'], to: ['CoachInvite', 'reviewSessionId'], card: '1 : N', label: 'um link por coach', right: true },
  { from: ['ReviewSession', 'id'], to: ['Assessment', 'reviewSessionId'], card: '1 : N', label: 'uma leitura por avaliador', right: true, accent: true },
  { from: ['CoachInvite', 'id'], to: ['Assessment', 'coachInviteId'], card: '1 : 1', accent: true },
  { from: ['HandRecord', 'id'], to: ['HandAssessment', 'handRecordId'], card: '1 : N', right: true, accent: true },
  { from: ['Assessment', 'id'], to: ['HandAssessment', 'assessmentId'], card: '1 : N', accent: true },
];

function tableSvg(t) {
  const g = GROUPS[t.g];
  const h = tableHeight(t);
  const rows = t.fields
    .map(([name, type, key], i) => {
      const y = t.y + HEAD_H + i * ROW_H + 12;
      const keyMark = key === 'pk' ? '◆' : key === 'fk' ? '◇' : '';
      return `    <text x="${t.x + 10}" y="${y}" font-size="11" fill="${INK}">${esc(keyMark)}${keyMark ? ' ' : ''}${esc(name)}</text>
    <text x="${t.x + t.w - 10}" y="${y}" font-size="10" fill="${MUTED}" text-anchor="end">${esc(type)}</text>`;
    })
    .join('\n');
  return `  <g>
    <rect x="${t.x}" y="${t.y}" width="${t.w}" height="${h}" rx="6" fill="${PAPER}" stroke="${g.stroke}" stroke-width="1.2"/>
    <path d="M${t.x} ${t.y + 6} a6 6 0 0 1 6 -6 h${t.w - 12} a6 6 0 0 1 6 6 v${HEAD_H - 6} h-${t.w} z" fill="${g.fill}"/>
    <line x1="${t.x}" y1="${t.y + HEAD_H}" x2="${t.x + t.w}" y2="${t.y + HEAD_H}" stroke="${g.stroke}" stroke-width="1.2"/>
    <text x="${t.x + 10}" y="${t.y + 18}" font-size="12.5" font-weight="700" fill="${INK}">${esc(t.id)}</text>
${rows}
  </g>`;
}

function edgeSvg(e) {
  const [fromId, fromField] = e.from;
  const [toId, toField] = e.to;
  const a = byId[fromId];
  const b = byId[toId];
  const ay = fieldY(fromId, fromField);
  const by = fieldY(toId, toField);
  const stroke = e.accent ? ACCENT : LINE;
  const width = e.accent ? 1.6 : 1.1;

  // Leave the right face when the target sits to the right, else the left.
  // Down its own column: out of the left face, into a lane of its own, and
  // back into the left face of the child. Lines that share a lane would be
  // one line, so each gets its own.
  if (e.lane !== undefined) {
    const lane = a.x - 12 - e.lane * 7;
    const d = `M${a.x} ${ay} H${lane} V${by} H${b.x}`;
    return `  <path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" marker-end="url(#erArrow)"/>
  <text x="${b.x + 8}" y="${by - 5}" font-size="9" fill="${MUTED}">${esc(e.card)}</text>`;
  }

  const goesRight = e.right ?? b.x > a.x;
  const ax = goesRight ? a.x + a.w : a.x;
  const bx = goesRight ? b.x : b.x + b.w;
  const mid = goesRight ? Math.max(ax + 14, bx - 14) : Math.min(ax - 14, bx + 14);
  const d = `M${ax} ${ay} H${mid} V${by} H${bx}`;

  const labelX = (mid + bx) / 2;
  const label = e.label
    ? `  <text x="${labelX}" y="${by - 6}" font-size="9.5" fill="${MUTED}" text-anchor="middle">${esc(e.label)}</text>`
    : '';
  return `  <path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" marker-end="url(#erArrow)"/>
  <text x="${ax + (goesRight ? 6 : -6)}" y="${ay - 5}" font-size="9" fill="${MUTED}" text-anchor="${goesRight ? 'start' : 'end'}">${esc(e.card)}</text>
${label}`;
}

const ER_W = 1500;
const ER_H = 1180;

const legendItems = Object.values(GROUPS)
  .map((g, i) => `  <rect x="${36 + i * 250}" y="86" width="14" height="14" rx="3" fill="${g.fill}" stroke="${g.stroke}"/>
  <text x="${56 + i * 250}" y="97" font-size="11" fill="${MUTED}">${esc(g.label)}</text>`)
  .join('\n');

const er = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ER_W} ${ER_H}" width="${ER_W}" height="${ER_H}" role="img" aria-label="Modelo de entidade e relacionamento do PokerStudio Replayer: 25 tabelas em quatro domínios — identidade e acesso, revisão e avaliação, preferências do jogador, produto e operação.">
  <defs>
    <marker id="erArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 1 L9 5 L0 9 z" fill="${LINE}"/>
    </marker>
  </defs>
  <rect width="${ER_W}" height="${ER_H}" fill="${PAPER}"/>
  <text x="36" y="44" font-size="21" font-weight="700" fill="${INK}">PokerStudio Replayer — modelo de entidade e relacionamento</text>
  <text x="36" y="66" font-size="12" fill="${MUTED}">PostgreSQL 16 via Prisma · ◆ chave primária · ◇ chave estrangeira · em vermelho, o caminho de uma avaliação</text>
${legendItems}
${EDGES.map(edgeSvg).join('\n')}
${TABLES.map(tableSvg).join('\n')}
  <text x="36" y="${ER_H - 20}" font-size="10" fill="${MUTED}">Gerado de prisma/schema.prisma · ReviewNote precede Assessment e é mantida por compatibilidade · pokerstudio.com.br</text>
</svg>
`;

fs.writeFileSync(path.join(OUT, 'modelo-entidade-relacionamento.svg'), er);

/* ------------------------------------------------------------------ */
/* 2. Arquitetura                                                      */
/* ------------------------------------------------------------------ */

const A_W = 1440;
const A_H = 940;

const box = (x, y, w, h, title, lines, opts = {}) => {
  const fill = opts.fill ?? PAPER;
  const stroke = opts.stroke ?? LINE;
  const body = (lines ?? [])
    .map((l, i) => `    <text x="${x + 12}" y="${y + 40 + i * 15}" font-size="10.5" fill="${MUTED}">${esc(l)}</text>`)
    .join('\n');
  return `  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="${opts.bold ? 1.8 : 1.2}"/>
    <text x="${x + 12}" y="${y + 22}" font-size="12.5" font-weight="700" fill="${opts.ink ?? INK}">${esc(title)}</text>
${body}
  </g>`;
};

const zone = (x, y, w, h, label, fill, stroke) => `  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-dasharray="6 4" stroke-width="1.2"/>
    <text x="${x + 14}" y="${y + 20}" font-size="12" font-weight="700" fill="${MUTED}">${esc(label)}</text>
  </g>`;

const arrow = (x1, y1, x2, y2, label, opts = {}) => {
  const stroke = opts.accent ? ACCENT : INK;
  const dash = opts.dashed ? ' stroke-dasharray="5 4"' : '';
  const d = opts.bend
    ? `M${x1} ${y1} H${opts.bend} V${y2} H${x2}`
    : `M${x1} ${y1} L${x2} ${y2}`;
  const lx = opts.lx ?? (x1 + x2) / 2;
  const ly = opts.ly ?? (y1 + y2) / 2 - 7;
  return `  <path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.4"${dash} marker-end="url(#aArrow)"/>
  <text x="${lx}" y="${ly}" font-size="10" fill="${opts.accent ? ACCENT : MUTED}" text-anchor="middle">${esc(label)}</text>`;
};

const arch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${A_W} ${A_H}" width="${A_W}" height="${A_H}" role="img" aria-label="Arquitetura do PokerStudio Replayer: navegador com parser em Web Worker e biblioteca local em IndexedDB, API Fastify em camadas sobre PostgreSQL, e o acesso restrito do coach por link e senha.">
  <defs>
    <marker id="aArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 1 L9 5 L0 9 z" fill="${INK}"/>
    </marker>
  </defs>
  <rect width="${A_W}" height="${A_H}" fill="${PAPER}"/>
  <text x="40" y="44" font-size="21" font-weight="700" fill="${INK}">PokerStudio Replayer — arquitetura</text>
  <text x="40" y="66" font-size="12" fill="${MUTED}">Monorepo npm workspaces · o histórico de mãos é lido e reproduzido no navegador; o servidor guarda conta, review e avaliações</text>

${zone(40, 92, 560, 520, 'Navegador do jogador', '#f7f9fd', '#c3cfe6')}
${box(60, 126, 520, 92, 'Interface — React 18 + Vite + Tailwind', [
  'Biblioteca · Replayer · Skins · Configurações · Admin · Relatórios',
  'i18n em 8 idiomas (i18next) · tour guiado · estado em Zustand',
], { fill: '#ffffff', stroke: '#c3cfe6', bold: true })}
${box(60, 234, 250, 108, 'Renderizadores da mesa', [
  'Three.js (R3F) com overlays HTML',
  'SVG como alternativa e fallback',
  'Geometria normalizada compartilhada',
], { stroke: '#c3cfe6' })}
${box(330, 234, 250, 108, 'Parser em Web Worker', [
  'PokerStars implementado',
  '6 salas reconhecidas, sem gramática',
  'Fora da thread da interface',
], { stroke: '#c3cfe6' })}
${box(60, 358, 250, 96, 'IndexedDB (Dexie)', [
  'Sessões, mãos e notas locais',
  'Skins e configurações',
  'Funciona sem conta',
], { stroke: '#c3cfe6' })}
${box(330, 358, 250, 96, 'localStorage', [
  'Último ponto da review',
  'Consentimento e preferências',
], { stroke: '#c3cfe6' })}
${box(60, 470, 520, 74, 'Arquivo .txt do jogador', [
  'Lido no dispositivo. Só sobe para o servidor quando o jogador escolhe "salvar na conta".',
], { fill: '#eef7f0', stroke: '#b6d8c1' })}

${zone(660, 92, 470, 700, 'Servidor — Node 24 + Fastify 5', '#fdf7f7', '#e8c3c0')}
${box(680, 126, 430, 84, 'interface/http — rotas, cookies, CSRF', [
  'auth · oauth · twofactor · reviews · skins',
  'admin · usage · feedback · assessments · coach',
], { stroke: '#e8c3c0' })}
${box(680, 226, 430, 84, 'application — casos de uso', [
  'LoginUser · SignInWithProvider · CloudReviews',
  'Assessments · CoachInvites · ManageUsers · Feedback',
], { stroke: '#e8c3c0' })}
${box(680, 326, 430, 68, 'domain — entidades e erros', [
  'User · Result<T, AppError> · catálogo de erros',
], { stroke: '#e8c3c0' })}
${box(680, 410, 430, 84, 'infrastructure — adaptadores', [
  'Prisma · argon2id · AES-256-GCM · otplib',
  'OIDC (Google, Facebook, Apple) · e-mail · GeoIP',
], { stroke: '#e8c3c0' })}
${box(680, 510, 430, 74, 'packages/shared — regras de cálculo', [
  'Score, cobertura VPIP, leaks, rubrica, senha do coach',
  'Mesmo código na interface e no servidor',
], { fill: '#fdeceb', stroke: '#e8c3c0', bold: true })}
${box(680, 600, 430, 78, 'Composition root — main-container.ts', [
  'Uma única montagem de dependências',
  'Provedor social só existe quando configurado',
], { stroke: '#e8c3c0' })}
${box(680, 694, 430, 74, 'PostgreSQL 16', [
  '25 tabelas · migrações versionadas pelo Prisma',
  'Base de desenvolvimento e base de teste separadas',
], { fill: '#f6f1fa', stroke: '#cdbede', bold: true })}

${zone(1190, 92, 210, 380, 'Serviços externos', '#fafafa', '#d8d8e0')}
${box(1206, 126, 178, 66, 'Google · Facebook', ['OAuth 2.0 / OIDC', 'PKCE e appsecret_proof'], { stroke: '#d8d8e0' })}
${box(1206, 208, 178, 66, 'Apple', ['Sign in with Apple', 'client secret ES256'], { stroke: '#d8d8e0' })}
${box(1206, 290, 178, 58, 'Provedor de e-mail', ['Resend ou SMTP'], { stroke: '#d8d8e0' })}
${box(1206, 364, 178, 58, 'Turnstile · MaxMind', ['Anti-bot e país'], { stroke: '#d8d8e0' })}

${zone(40, 640, 560, 200, 'Acesso restrito do coach', '#f6f1fa', '#cdbede')}
${box(60, 674, 250, 146, 'Link + senha', [
  'Token imprevisível na URL',
  'Senha de 8 caracteres, só o hash',
  'Cookie próprio, escopo de uma review',
  'Prazo e revogação verificados',
  'a cada requisição',
], { stroke: '#cdbede' })}
${box(330, 674, 250, 146, 'O que o coach vê', [
  'Replayer da sessão avaliada',
  'Notas, tags, comentários e OK',
  'Progresso e conclusão',
  '—',
  'Não vê biblioteca, importação, skins,',
  'administração nem outras avaliações',
], { stroke: '#cdbede' })}

${arrow(580, 172, 680, 172, 'HTTPS · JSON · cookie de sessão', { lx: 630, ly: 150 })}
${arrow(580, 507, 680, 250, 'salvar review na conta', { bend: 634, lx: 636, ly: 470 })}
${arrow(580, 745, 680, 168, 'token + senha', { bend: 620, accent: true, lx: 622, ly: 640 })}
${arrow(1110, 452, 1206, 160, 'código ↔ token', { bend: 1160, lx: 1162, ly: 300 })}
${arrow(1110, 452, 1206, 320, 'envio de e-mail', { bend: 1176, dashed: true, lx: 1178, ly: 400 })}
${arrow(895, 584, 895, 694, 'consultas e migrações', {})}
${arrow(895, 494, 895, 510, '', {})}

  <text x="40" y="880" font-size="11" fill="${MUTED}">Produção: build estático do web servido por nginx em replayer.pokerstudio.com.br · API e PostgreSQL em Docker no mesmo VPS</text>
  <text x="40" y="900" font-size="11" fill="${MUTED}">Testes: Vitest — 124 na API (incluindo as regras de avaliação) e 90 no web · suítes da API contra a base de teste, uma por vez</text>
  <text x="40" y="920" font-size="10" fill="${MUTED}">Gerado do código em 07/09/2026 · pokerstudio.com.br</text>
</svg>
`;

fs.writeFileSync(path.join(OUT, 'arquitetura.svg'), arch);
console.log('dois SVG escritos em docs/diagramas');
