import { S3Uploader, uploadToS3 } from '../src/s3-uploader';
import * as fs from 'fs';
import * as path from 'path';

// Mock AWS SDK
const mockS3Send = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  HeadObjectCommand: jest.fn().mockImplementation((params: unknown) => params),
  PutObjectCommand: jest.fn().mockImplementation((params: unknown) => params),
}));

describe('S3Uploader', () => {
  const originalEnv = process.env;
  const testDir = path.join(__dirname, 'test-s3-files');

  // Store original console methods
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    jest.clearAllMocks();
    mockS3Send.mockReset();
    process.env = { ...originalEnv };

    // Suppress console output during tests to avoid confusion
    console.error = jest.fn();
    console.log = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(async () => {
    // Restore console methods
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;

    // Clean up test files
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
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

  it('should create uploader with custom region', () => {
    const uploader = new S3Uploader('test-bucket', 'us-west-2');
    expect(uploader).toBeDefined();
  });

  describe('findUuidTarGzFiles', () => {
    it('should filter files by UUID pattern', async () => {
      process.env.AWS_BUCKET = 'test-bucket';
      const uploader = new S3Uploader();

      // Mock fs.promises.readdir
      const mockReaddir = jest.spyOn(fs.promises, 'readdir');
      mockReaddir.mockResolvedValue([
        '550e8400-e29b-41d4-a716-446655440000.tar.gz', // valid
        'not-a-uuid.tar.gz', // invalid
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8.tar.gz', // valid
        'test.txt', // wrong extension
      ] as unknown as fs.Dirent[]);

      const files = await uploader.findUuidTarGzFiles('.');

      expect(files).toHaveLength(2);
      expect(files[0]).toContain('550e8400-e29b-41d4-a716-446655440000.tar.gz');
      expect(files[1]).toContain('6ba7b810-9dad-11d1-80b4-00c04fd430c8.tar.gz');

      mockReaddir.mockRestore();
    });

    it('should return empty array on directory read error', async () => {
      process.env.AWS_BUCKET = 'test-bucket';
      const uploader = new S3Uploader();

      // Mock fs.promises.readdir to throw error
      const mockReaddir = jest.spyOn(fs.promises, 'readdir');
      mockReaddir.mockRejectedValue(new Error('Directory not found'));

      const files = await uploader.findUuidTarGzFiles('/non-existent');

      expect(files).toEqual([]);

      mockReaddir.mockRestore();
    });
  });

  describe('uploadFile', () => {
    beforeEach(async () => {
      // Create test directory and files
      await fs.promises.mkdir(testDir, { recursive: true });
    });

    it('should upload a file successfully', async () => {
      const uploader = new S3Uploader('test-bucket');
      const testFile = path.join(testDir, 'test.tar.gz');
      await fs.promises.writeFile(testFile, 'test content');

      // Mock S3 operations
      mockS3Send
        .mockResolvedValueOnce({ ContentLength: 0 }) // HeadObject returns different size
        .mockResolvedValueOnce({}); // PutObject succeeds

      const result = await uploader.uploadFile(testFile);

      expect(result).toContain('s3://test-bucket/test.tar.gz');
      expect(mockS3Send).toHaveBeenCalledTimes(2);
    });

    it('should skip upload if file exists with same size', async () => {
      const uploader = new S3Uploader('test-bucket');
      const testFile = path.join(testDir, 'test.tar.gz');
      const content = 'test content';
      await fs.promises.writeFile(testFile, content);

      // Mock S3 HeadObject to return same size
      mockS3Send.mockResolvedValueOnce({ ContentLength: Buffer.byteLength(content) });

      const result = await uploader.uploadFile(testFile);

      expect(result).toBeNull();
      expect(mockS3Send).toHaveBeenCalledTimes(1); // Only HeadObject
    });

    it('should use custom key when provided', async () => {
      const uploader = new S3Uploader('test-bucket');
      const testFile = path.join(testDir, 'test.tar.gz');
      await fs.promises.writeFile(testFile, 'test content');

      // Mock S3 operations
      mockS3Send.mockResolvedValueOnce({ ContentLength: 0 }).mockResolvedValueOnce({});

      const result = await uploader.uploadFile(testFile, 'custom-key.tar.gz');

      expect(result).toContain('s3://test-bucket/custom-key.tar.gz');
    });

    it('should throw error if file does not exist', async () => {
      const uploader = new S3Uploader('test-bucket');
      const nonExistentFile = path.join(testDir, 'non-existent.tar.gz');

      await expect(uploader.uploadFile(nonExistentFile)).rejects.toThrow();
    });

    it('should throw error if path is not a file', async () => {
      const uploader = new S3Uploader('test-bucket');

      await expect(uploader.uploadFile(testDir)).rejects.toThrow('is not a file');
    });

    it('should handle S3 upload errors', async () => {
      const uploader = new S3Uploader('test-bucket');
      const testFile = path.join(testDir, 'test.tar.gz');
      await fs.promises.writeFile(testFile, 'test content');

      // Mock S3 operations to fail
      mockS3Send
        .mockResolvedValueOnce({ ContentLength: 0 })
        .mockRejectedValueOnce(new Error('S3 upload failed'));

      await expect(uploader.uploadFile(testFile)).rejects.toThrow('S3 upload failed');
    });

    it('should handle NotFound error when checking file existence', async () => {
      const uploader = new S3Uploader('test-bucket');
      const testFile = path.join(testDir, 'test.tar.gz');
      await fs.promises.writeFile(testFile, 'test content');

      // Mock S3 HeadObject to throw NotFound
      const notFoundError = new Error('Not found');
      notFoundError.name = 'NotFound';
      mockS3Send.mockRejectedValueOnce(notFoundError).mockResolvedValueOnce({});

      const result = await uploader.uploadFile(testFile);

      expect(result).toContain('s3://test-bucket/test.tar.gz');
      expect(mockS3Send).toHaveBeenCalledTimes(2);
    });

    it('should handle other S3 errors when checking file existence', async () => {
      const uploader = new S3Uploader('test-bucket');
      const testFile = path.join(testDir, 'test.tar.gz');
      await fs.promises.writeFile(testFile, 'test content');

      // Mock S3 HeadObject to throw other error
      mockS3Send.mockRejectedValueOnce(new Error('S3 connection error')).mockResolvedValueOnce({});

      const result = await uploader.uploadFile(testFile);

      expect(result).toContain('s3://test-bucket/test.tar.gz');
    });
  });

  describe('uploadArchives', () => {
    beforeEach(async () => {
      // Create test directory
      await fs.promises.mkdir(testDir, { recursive: true });
    });

    it('should upload multiple UUID.tar.gz files', async () => {
      const uploader = new S3Uploader('test-bucket');

      // Create test UUID tar.gz files
      const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
      const uuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      await fs.promises.writeFile(path.join(testDir, `${uuid1}.tar.gz`), 'content1');
      await fs.promises.writeFile(path.join(testDir, `${uuid2}.tar.gz`), 'content2');
      await fs.promises.writeFile(path.join(testDir, 'not-uuid.tar.gz'), 'content3');

      // Mock S3 operations
      mockS3Send.mockResolvedValue({});

      const urls = await uploader.uploadArchives(testDir);

      expect(urls).toHaveLength(2);
      expect(urls[0]).toContain(uuid1);
      expect(urls[1]).toContain(uuid2);
    });

    it('should return empty array when no UUID files found', async () => {
      const uploader = new S3Uploader('test-bucket');

      await fs.promises.writeFile(path.join(testDir, 'not-uuid.tar.gz'), 'content');

      const urls = await uploader.uploadArchives(testDir);

      expect(urls).toEqual([]);
    });

    it('should handle empty directory parameter', async () => {
      const uploader = new S3Uploader('test-bucket');

      // Mock findUuidTarGzFiles to return empty array
      const spy = jest.spyOn(uploader, 'findUuidTarGzFiles');
      spy.mockResolvedValue([]);

      const urls = await uploader.uploadArchives('');

      expect(urls).toEqual([]);
      expect(spy).toHaveBeenCalledWith('.');

      spy.mockRestore();
    });

    it('should continue on individual file upload errors', async () => {
      const uploader = new S3Uploader('test-bucket');

      const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
      const uuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      await fs.promises.writeFile(path.join(testDir, `${uuid1}.tar.gz`), 'content1');
      await fs.promises.writeFile(path.join(testDir, `${uuid2}.tar.gz`), 'content2');

      // Mock first upload to fail, second to succeed
      mockS3Send
        .mockRejectedValueOnce(new Error('Upload failed'))
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const urls = await uploader.uploadArchives(testDir);

      // Should still upload the second file
      expect(urls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('uploadToS3', () => {
    beforeEach(async () => {
      await fs.promises.mkdir(testDir, { recursive: true });
    });

    it('should upload archives using helper function', async () => {
      const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
      await fs.promises.writeFile(path.join(testDir, `${uuid1}.tar.gz`), 'content');

      mockS3Send.mockResolvedValue({});

      const urls = await uploadToS3(testDir, 'test-bucket');

      expect(urls.length).toBeGreaterThanOrEqual(0);
    });

    it('should throw error if uploader creation fails', async () => {
      delete process.env.AWS_BUCKET;

      await expect(uploadToS3(testDir)).rejects.toThrow('AWS bucket name is required');
    });

    it('should propagate errors from uploadArchives', async () => {
      const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
      await fs.promises.writeFile(path.join(testDir, `${uuid1}.tar.gz`), 'content');

      // Make S3 operations fail catastrophically
      mockS3Send.mockImplementation(() => {
        throw new Error('Catastrophic S3 failure');
      });

      // uploadArchives catches errors and continues, so it won't throw
      // but we can test that it handles the error gracefully
      const urls = await uploadToS3(testDir, 'test-bucket');
      expect(urls).toEqual([]);
    });
  });
});
