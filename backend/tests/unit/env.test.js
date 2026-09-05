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
      baseEnv({ NODE_ENV: 'production', DB_PASSWORD: 'realpassword', ...overrides });

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

  it('silences logging by default under NODE_ENV=test', () => {
    expect(loadConfig(baseEnv({ NODE_ENV: 'test' })).logging.level).toBe('silent');
  });
});
