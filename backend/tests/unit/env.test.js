'use strict';

const { loadConfig, ConfigError, MIN_SECRET_LENGTH } = require('../../src/config/env');

/** A minimal environment that must always validate. */
function baseEnv(overrides = {}) {
  return {
    NODE_ENV: 'development',
    DB_HOST: 'localhost',
    DB_USER: 'postgres',
    DB_NAME: 'campusos',
    JWT_SECRET: 'a'.repeat(MIN_SECRET_LENGTH),
    ...overrides,
  };
}

describe('loadConfig', () => {
  it('accepts a valid environment and applies documented defaults', () => {
    const config = loadConfig(baseEnv());

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(5000);
    expect(config.database.port).toBe(5432);
    expect(config.security.bcryptRounds).toBe(12);
    expect(config.jwt.accessTokenTtl).toBe('15m');
    expect(config.security.corsOrigins).toEqual(['http://localhost:5173']);
  });

  it('returns a frozen object so configuration cannot drift at runtime', () => {
    const config = loadConfig(baseEnv());
    expect(Object.isFrozen(config)).toBe(true);
    expect(() => { config.port = 9999; }).toThrow();
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadConfig(baseEnv({ NODE_ENV: 'staging' }))).toThrow(ConfigError);
  });

  it('reports every problem at once rather than only the first', () => {
    let caught;
    try {
      loadConfig({ NODE_ENV: 'development' });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ConfigError);
    expect(caught.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('DB_HOST'),
        expect.stringContaining('DB_USER'),
        expect.stringContaining('DB_NAME'),
        expect.stringContaining('JWT_SECRET'),
      ]),
    );
  });

  it('accepts DATABASE_URL as a substitute for the discrete DB_* values', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres:pw@localhost:5432/campusos',
      JWT_SECRET: 'x'.repeat(MIN_SECRET_LENGTH),
    });

    expect(config.database.connectionString).toBe('postgresql://postgres:pw@localhost:5432/campusos');
  });

  it('rejects a non-integer PORT instead of silently coercing to NaN', () => {
    expect(() => loadConfig(baseEnv({ PORT: 'not-a-port' }))).toThrow(/PORT must be an integer/);
  });

  it('rejects a PORT outside the valid TCP range', () => {
    expect(() => loadConfig(baseEnv({ PORT: '70000' }))).toThrow(/between 1 and 65535/);
  });

  describe('production hardening', () => {
    const prodEnv = (overrides) =>
      baseEnv({ NODE_ENV: 'production', DB_PASSWORD: 'realpassword', SMTP_HOST: 'smtp.test', ...overrides });

    it('requires SMTP, since sign-up and password reset depend on email', () => {
      const env = prodEnv();
      delete env.SMTP_HOST;
      expect(() => loadConfig(env)).toThrow(/SMTP_HOST is required in production/);
    });

    it('rejects a short JWT_SECRET', () => {
      expect(() => loadConfig(prodEnv({ JWT_SECRET: 'short' }))).toThrow(
        new RegExp(`at least ${MIN_SECRET_LENGTH} characters`),
      );
    });

    it('requires a database password', () => {
      const env = prodEnv();
      delete env.DB_PASSWORD;
      expect(() => loadConfig(env)).toThrow(/DB_PASSWORD is required in production/);
    });

    it('allows a short secret outside production so local setup is not blocked', () => {
      expect(() => loadConfig(baseEnv({ JWT_SECRET: 'short' }))).not.toThrow();
    });

    it('defaults pretty logging off', () => {
      expect(loadConfig(prodEnv()).logging.pretty).toBe(false);
    });
  });

  describe('bcrypt cost', () => {
    it.each([9, 16])('rejects a cost of %i as outside the safe range', (rounds) => {
      expect(() => loadConfig(baseEnv({ BCRYPT_ROUNDS: String(rounds) }))).toThrow(/BCRYPT_ROUNDS/);
    });

    it.each([10, 12, 15])('accepts a cost of %i', (rounds) => {
      expect(loadConfig(baseEnv({ BCRYPT_ROUNDS: String(rounds) })).security.bcryptRounds).toBe(rounds);
    });
  });

  describe('list and boolean parsing', () => {
    it('splits CORS_ORIGINS on commas and trims whitespace', () => {
      const config = loadConfig(
        baseEnv({ CORS_ORIGINS: 'http://a.test , http://b.test,,http://c.test' }),
      );
      expect(config.security.corsOrigins).toEqual(['http://a.test', 'http://b.test', 'http://c.test']);
    });

    it.each([['true', true], ['1', true], ['YES', true], ['on', true], ['false', false], ['0', false]])(
      'reads DB_SSL="%s" as %s',
      (raw, expected) => {
        expect(Boolean(loadConfig(baseEnv({ DB_SSL: raw })).database.ssl)).toBe(expected);
      },
    );
  });

  describe('durations', () => {
    it('converts token lifetimes into milliseconds', () => {
      const config = loadConfig(baseEnv({ JWT_ACCESS_TTL: '30s', JWT_REFRESH_TTL: '12h' }));
      expect(config.jwt.accessTokenTtl).toBe('30s');
      expect(config.jwt.accessTokenTtlMs).toBe(30_000);
      expect(config.jwt.refreshTokenTtlMs).toBe(12 * 60 * 60 * 1000);
    });

    it.each(['15', '0m', 'ten minutes', '5w'])('rejects the malformed duration "%s"', (raw) => {
      expect(() => loadConfig(baseEnv({ JWT_REFRESH_TTL: raw }))).toThrow(/JWT_REFRESH_TTL must be a duration/);
    });
  });

  describe('auth settings', () => {
    it('defaults to the college domain and conservative limits', () => {
      const { auth, appUrl } = loadConfig(baseEnv());
      expect(auth.allowedEmailDomains).toEqual(['mmcoe.edu.in']);
      expect(auth).toMatchObject({ otpTtlMinutes: 10, otpMaxAttempts: 5, maxFailedLogins: 5, lockoutMinutes: 15 });
      expect(appUrl).toBe('http://localhost:5173');
    });

    it('lower-cases allowed domains and strips a trailing slash from APP_URL', () => {
      const config = loadConfig(baseEnv({ ALLOWED_EMAIL_DOMAINS: 'MMCOE.edu.in, Example.org', APP_URL: 'https://campus.test/' }));
      expect(config.auth.allowedEmailDomains).toEqual(['mmcoe.edu.in', 'example.org']);
      expect(config.appUrl).toBe('https://campus.test');
    });

    it.each([
      ['OTP_TTL_MINUTES', '0'],
      ['OTP_TTL_MINUTES', '61'],
      ['OTP_MAX_ATTEMPTS', '11'],
      ['OTP_MAX_PER_HOUR', '0'],
      ['OTP_RESEND_COOLDOWN_SECONDS', '-1'],
      ['LOGIN_MAX_FAILED_ATTEMPTS', '0'],
      ['LOGIN_LOCKOUT_MINUTES', '0'],
    ])('rejects %s=%s', (key, value) => {
      expect(() => loadConfig(baseEnv({ [key]: value }))).toThrow(new RegExp(key));
    });

    it('does not require SMTP outside production', () => {
      expect(loadConfig(baseEnv()).mail.host).toBe('');
    });
  });

  it('silences logging by default under NODE_ENV=test', () => {
    expect(loadConfig(baseEnv({ NODE_ENV: 'test' })).logging.level).toBe('silent');
  });
});
