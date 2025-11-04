import {
  getConfig,
  validateConfig,
  shouldCreateArchive,
  shouldUploadToServer,
  shouldUploadToS3,
} from '../src/config';

describe('getConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should throw error if token is in config', () => {
    expect(() => {
      getConfig({ token: 'secret-token' });
    }).toThrow('SECURITY ERROR');
  });

  it('should get token from environment only', () => {
    process.env.IBUTSU_TOKEN = 'env-token';
    const config = getConfig({});
    expect(config.token).toBe('env-token');
  });

  it('should prioritize environment variables over config', () => {
    process.env.IBUTSU_SERVER = 'http://env-server';
    const config = getConfig({ server: 'http://config-server' });
    expect(config.server).toBe('http://env-server');
  });

  it('should use config values when env vars not set', () => {
    const config = getConfig({
      server: 'http://config-server',
      source: 'test-source',
    });
    expect(config.server).toBe('http://config-server');
    expect(config.source).toBe('test-source');
  });

  it('should handle mode configuration', () => {
    process.env.IBUTSU_MODE = 'archive';
    const config = getConfig({});
    expect(config.mode).toBe('archive');
  });
});

describe('validateConfig', () => {
  it('should require server when mode is server', () => {
    expect(() => {
      validateConfig({ mode: 'server' });
    }).toThrow('IBUTSU_SERVER is required');
  });

  it('should require token when mode is server', () => {
    expect(() => {
      validateConfig({ mode: 'server', server: 'http://test' });
    }).toThrow('IBUTSU_TOKEN is required');
  });

  it('should normalize server URL', () => {
    const config = {
      mode: 'server' as const,
      server: 'http://test.com/',
      token: 'test-token',
    };
    validateConfig(config);
    expect(config.server).toBe('http://test.com/api');
  });

  it('should not require server for archive mode', () => {
    expect(() => {
      validateConfig({ mode: 'archive' });
    }).not.toThrow();
  });
});

describe('shouldCreateArchive', () => {
  it('should return true for archive mode', () => {
    expect(shouldCreateArchive({ mode: 'archive' })).toBe(true);
  });

  it('should return true for both mode', () => {
    expect(shouldCreateArchive({ mode: 'both' })).toBe(true);
  });

  it('should return false when noArchive is true', () => {
    expect(shouldCreateArchive({ mode: 'archive', noArchive: true })).toBe(false);
  });

  it('should return false for server mode', () => {
    expect(shouldCreateArchive({ mode: 'server' })).toBe(false);
  });
});

describe('shouldUploadToServer', () => {
  it('should return true for server mode', () => {
    expect(shouldUploadToServer({ mode: 'server' })).toBe(true);
  });

  it('should return true for both mode', () => {
    expect(shouldUploadToServer({ mode: 'both' })).toBe(true);
  });

  it('should return false for archive mode', () => {
    expect(shouldUploadToServer({ mode: 'archive' })).toBe(false);
  });
});

describe('shouldUploadToS3', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return true when bucket and credentials are set', () => {
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    expect(shouldUploadToS3({ s3Bucket: 'test-bucket' })).toBe(true);
  });

  it('should return true when bucket and AWS profile are set', () => {
    process.env.AWS_PROFILE = 'default';
    expect(shouldUploadToS3({ s3Bucket: 'test-bucket' })).toBe(true);
  });

  it('should return false when bucket is not set', () => {
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    expect(shouldUploadToS3({})).toBe(false);
  });

  it('should return false when credentials are not set', () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_PROFILE;
    expect(shouldUploadToS3({ s3Bucket: 'test-bucket' })).toBe(false);
  });
});
