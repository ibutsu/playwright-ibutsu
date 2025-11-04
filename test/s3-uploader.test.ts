import { isValidUUID } from '../src/types';
import { S3Uploader } from '../src/s3-uploader';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  HeadObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
}));

describe('S3Uploader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should throw error if bucket name is not provided', () => {
    delete process.env.AWS_BUCKET;
    expect(() => {
      new S3Uploader();
    }).toThrow('AWS bucket name is required');
  });

  it('should create uploader with bucket name from env', () => {
    process.env.AWS_BUCKET = 'test-bucket';
    const uploader = new S3Uploader();
    expect(uploader).toBeDefined();
  });

  it('should create uploader with bucket name parameter', () => {
    const uploader = new S3Uploader('test-bucket');
    expect(uploader).toBeDefined();
  });

  describe('findUuidTarGzFiles', () => {
    it('should filter files by UUID pattern', async () => {
      process.env.AWS_BUCKET = 'test-bucket';
      const uploader = new S3Uploader();

      // Mock fs.promises.readdir
      const mockReaddir = jest.spyOn(require('fs').promises, 'readdir');
      mockReaddir.mockResolvedValue([
        '550e8400-e29b-41d4-a716-446655440000.tar.gz', // valid
        'not-a-uuid.tar.gz', // invalid
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8.tar.gz', // valid
        'test.txt', // wrong extension
      ]);

      const files = await uploader.findUuidTarGzFiles('.');

      expect(files).toHaveLength(2);
      expect(files[0]).toContain('550e8400-e29b-41d4-a716-446655440000.tar.gz');
      expect(files[1]).toContain('6ba7b810-9dad-11d1-80b4-00c04fd430c8.tar.gz');

      mockReaddir.mockRestore();
    });
  });
});
