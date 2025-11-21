import {
  getConfig,
  validateConfig,
  shouldCreateArchive,
  shouldUploadToServer,
  shouldUploadToS3,
  isArchiveMode,
  isS3Mode,
  isServerMode,
  getServerUrl,
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
    process.env.IBUTSU_MODE = 'http://env-server';
    const config = getConfig({ mode: 'http://config-server' });
    expect(config.mode).toBe('http://env-server');
  });

  it('should use config values when env vars not set', () => {
    const config = getConfig({
      mode: 'http://config-server',
      source: 'test-source',
    });
    expect(config.mode).toBe('http://config-server');
    expect(config.source).toBe('test-source');
  });

  it('should handle archive mode configuration', () => {
    process.env.IBUTSU_MODE = 'archive';
    const config = getConfig({});
    expect(config.mode).toBe('archive');
  });

  it('should handle s3 mode configuration', () => {
    process.env.IBUTSU_MODE = 's3';
    const config = getConfig({});
    expect(config.mode).toBe('s3');
  });

  it('should handle server URL mode configuration', () => {
    process.env.IBUTSU_MODE = 'https://ibutsu.example.com';
    const config = getConfig({});
    expect(config.mode).toBe('https://ibutsu.example.com');
  });
});

describe('validateConfig', () => {
  it('should require token when mode is a URL', () => {
    expect(() => {
      validateConfig({ mode: 'http://test.com' });
    }).toThrow('IBUTSU_TOKEN is required');
  });

  it('should require project when mode is a URL', () => {
    expect(() => {
      validateConfig({ mode: 'http://test.com', token: 'test-token' });
    }).toThrow('IBUTSU_PROJECT is required');
  });

  it('should pass validation with token and project for server mode', () => {
    expect(() => {
      validateConfig({ mode: 'http://test.com', token: 'test-token', project: 'my-project' });
    }).not.toThrow();
  });

  it('should not require token for archive mode', () => {
    expect(() => {
      validateConfig({ mode: 'archive' });
    }).not.toThrow();
  });

  it('should not require token for s3 mode', () => {
    expect(() => {
      validateConfig({ mode: 's3' });
    }).not.toThrow();
  });
});

describe('isArchiveMode', () => {
  it('should return true when mode is archive', () => {
    expect(isArchiveMode({ mode: 'archive' })).toBe(true);
  });

  it('should return false when mode is s3', () => {
    expect(isArchiveMode({ mode: 's3' })).toBe(false);
  });

  it('should return false when mode is a URL', () => {
    expect(isArchiveMode({ mode: 'http://test.com' })).toBe(false);
  });
});

describe('isS3Mode', () => {
  it('should return true when mode is s3', () => {
    expect(isS3Mode({ mode: 's3' })).toBe(true);
  });

  it('should return false when mode is archive', () => {
    expect(isS3Mode({ mode: 'archive' })).toBe(false);
  });

  it('should return false when mode is a URL', () => {
    expect(isS3Mode({ mode: 'http://test.com' })).toBe(false);
  });
});

describe('isServerMode', () => {
  it('should return true when mode is a URL', () => {
    expect(isServerMode({ mode: 'http://test.com' })).toBe(true);
  });

  it('should return true when mode is https URL', () => {
    expect(isServerMode({ mode: 'https://ibutsu.example.com' })).toBe(true);
  });

  it('should return false when mode is archive', () => {
    expect(isServerMode({ mode: 'archive' })).toBe(false);
  });

  it('should return false when mode is s3', () => {
    expect(isServerMode({ mode: 's3' })).toBe(false);
  });

  it('should return false when mode is undefined', () => {
    expect(isServerMode({})).toBe(false);
  });
});

describe('getServerUrl', () => {
  it('should return normalized URL for server mode', () => {
    expect(getServerUrl({ mode: 'http://test.com' })).toBe('http://test.com/api');
  });

  it('should add /api suffix if not present', () => {
    expect(getServerUrl({ mode: 'https://ibutsu.example.com' })).toBe(
      'https://ibutsu.example.com/api'
    );
  });

  it('should not double /api suffix', () => {
    expect(getServerUrl({ mode: 'http://test.com/api' })).toBe('http://test.com/api');
  });

  it('should remove trailing slash', () => {
    expect(getServerUrl({ mode: 'http://test.com/' })).toBe('http://test.com/api');
  });

  it('should return undefined for archive mode', () => {
    expect(getServerUrl({ mode: 'archive' })).toBeUndefined();
  });

  it('should return undefined for s3 mode', () => {
    expect(getServerUrl({ mode: 's3' })).toBeUndefined();
  });
});

describe('shouldCreateArchive', () => {
  it('should return true for archive mode', () => {
    expect(shouldCreateArchive({ mode: 'archive' })).toBe(true);
  });

  it('should return true for s3 mode', () => {
    expect(shouldCreateArchive({ mode: 's3' })).toBe(true);
  });

  it('should return true for server URL mode', () => {
    expect(shouldCreateArchive({ mode: 'http://test.com' })).toBe(true);
  });

  it('should return false when noArchive is true', () => {
    expect(shouldCreateArchive({ mode: 'archive', noArchive: true })).toBe(false);
  });

  it('should return false when mode is not set', () => {
    expect(shouldCreateArchive({})).toBe(false);
  });
});

describe('shouldUploadToServer', () => {
  it('should return true when mode is a URL', () => {
    expect(shouldUploadToServer({ mode: 'http://test.com' })).toBe(true);
  });

  it('should return true when mode is https URL', () => {
    expect(shouldUploadToServer({ mode: 'https://ibutsu.example.com' })).toBe(true);
  });

  it('should return false for archive mode', () => {
    expect(shouldUploadToServer({ mode: 'archive' })).toBe(false);
  });

  it('should return false for s3 mode', () => {
    expect(shouldUploadToServer({ mode: 's3' })).toBe(false);
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

  it('should return true when mode is s3 and bucket and credentials are set', () => {
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    expect(shouldUploadToS3({ mode: 's3', s3Bucket: 'test-bucket' })).toBe(true);
  });

  it('should return true when mode is s3 and bucket and AWS profile are set', () => {
    process.env.AWS_PROFILE = 'default';
    expect(shouldUploadToS3({ mode: 's3', s3Bucket: 'test-bucket' })).toBe(true);
  });

  it('should return false when mode is not s3', () => {
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    expect(shouldUploadToS3({ mode: 'archive', s3Bucket: 'test-bucket' })).toBe(false);
  });

  it('should return false when bucket is not set', () => {
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    expect(shouldUploadToS3({ mode: 's3' })).toBe(false);
  });

  it('should return false when credentials are not set', () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_PROFILE;
    expect(shouldUploadToS3({ mode: 's3', s3Bucket: 'test-bucket' })).toBe(false);
  });
});
