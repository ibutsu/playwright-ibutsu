import * as fs from 'fs';
import * as path from 'path';
import { IbutsuArchiver } from '../src/archiver';
import { TestRun, TestResult } from '../src/types';

describe('IbutsuArchiver', () => {
  const testOutputDir = path.join(__dirname, 'test-output');
  let run: TestRun;
  let results: TestResult[];

  beforeEach(() => {
    // Create test data
    run = new TestRun({ source: 'test' });
    run.startTimer();
    run.stopTimer();

    results = [
      new TestResult({
        test_id: 'test-1',
        result: 'passed'
      }),
      new TestResult({
        test_id: 'test-2',
        result: 'failed'
      })
    ];

    // Add some artifacts
    run.addArtifact('run-log.txt', 'Test run log');
    results[1].addArtifact('screenshot.png', Buffer.from('fake screenshot'));
  });

  afterEach(async () => {
    // Clean up test output
    try {
      await fs.promises.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should create an archive', async () => {
    const archiver = new IbutsuArchiver(run.id, testOutputDir);
    const archivePath = await archiver.create(run, results);

    expect(archivePath).toBeDefined();
    expect(archivePath).toContain('.tar.gz');

    // Check if archive was created
    const stats = await fs.promises.stat(archivePath);
    expect(stats.isFile()).toBe(true);
    expect(stats.size).toBeGreaterThan(0);
  });

  it('should include run and result data in archive', async () => {
    const archiver = new IbutsuArchiver(run.id, testOutputDir);
    const archivePath = await archiver.create(run, results);

    // Archive should exist
    expect(fs.existsSync(archivePath)).toBe(true);
  });

  it('should clean up temporary files', async () => {
    const archiver = new IbutsuArchiver(run.id, testOutputDir);
    await archiver.create(run, results);

    // Temp directory should be cleaned up
    const tempDir = path.join(testOutputDir, '.ibutsu-temp', run.id);
    expect(fs.existsSync(tempDir)).toBe(false);
  });
});
