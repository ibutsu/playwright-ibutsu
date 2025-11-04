import * as tar from 'tar';
import * as fs from 'fs';
import * as path from 'path';
import { TestRun, TestResult } from './types';

/**
 * Creates a tar.gz archive for an Ibutsu test run
 */
export class IbutsuArchiver {
  private archivePath: string;
  private tempDir: string;

  constructor(runId: string, outputDir: string = '.') {
    this.archivePath = path.join(outputDir, `${runId}.tar.gz`);
    this.tempDir = path.join(outputDir, '.ibutsu-temp', runId);
  }

  /**
   * Create the archive with run and results data
   */
  async create(run: TestRun, results: TestResult[]): Promise<string> {
    // Create temporary directory structure
    await this.createTempStructure(run, results);

    // Create tar.gz archive
    await tar.create(
      {
        gzip: true,
        file: this.archivePath,
        cwd: path.dirname(this.tempDir),
      },
      [path.basename(this.tempDir)]
    );

    // Clean up temporary directory
    await this.cleanup();

    return this.archivePath;
  }

  /**
   * Create temporary directory structure for archiving
   */
  private async createTempStructure(run: TestRun, results: TestResult[]): Promise<void> {
    // Create base directory
    await fs.promises.mkdir(this.tempDir, { recursive: true });

    // Add run data
    await this.addRun(run);

    // Add results data
    for (const result of results) {
      await this.addResult(run, result);
    }
  }

  /**
   * Add run data to archive
   */
  private async addRun(run: TestRun): Promise<void> {
    const runDir = this.tempDir;

    // Write run.json
    const runData = run.toDict();
    await fs.promises.writeFile(
      path.join(runDir, 'run.json'),
      JSON.stringify(runData, null, 2),
      'utf-8'
    );

    // Add run artifacts
    const artifacts = run.getArtifacts();
    for (const [filename, data] of Object.entries(artifacts)) {
      await this.writeArtifact(runDir, filename, data);
    }
  }

  /**
   * Add result data to archive
   */
  private async addResult(run: TestRun, result: TestResult): Promise<void> {
    const resultDir = path.join(this.tempDir, result.id);
    await fs.promises.mkdir(resultDir, { recursive: true });

    // Write result.json
    const resultData = result.toDict();
    await fs.promises.writeFile(
      path.join(resultDir, 'result.json'),
      JSON.stringify(resultData, null, 2),
      'utf-8'
    );

    // Add result artifacts
    const artifacts = result.getArtifacts();
    for (const [filename, data] of Object.entries(artifacts)) {
      await this.writeArtifact(resultDir, filename, data);
    }
  }

  /**
   * Write an artifact file
   */
  private async writeArtifact(
    dir: string,
    filename: string,
    data: Buffer | string
  ): Promise<void> {
    try {
      const artifactPath = path.join(dir, filename);

      // Ensure parent directory exists
      await fs.promises.mkdir(path.dirname(artifactPath), { recursive: true });

      if (Buffer.isBuffer(data)) {
        await fs.promises.writeFile(artifactPath, data);
      } else if (typeof data === 'string') {
        // Check if it's a file path
        if (await this.isFilePath(data)) {
          // Copy the file
          await fs.promises.copyFile(data, artifactPath);
        } else {
          // Write as text content
          await fs.promises.writeFile(artifactPath, data, 'utf-8');
        }
      }
    } catch (error) {
      console.error(`Failed to write artifact ${filename}:`, error);
      // Continue with other artifacts even if one fails
    }
  }

  /**
   * Check if a string is a valid file path
   */
  private async isFilePath(str: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(str);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Clean up temporary directory
   */
  private async cleanup(): Promise<void> {
    try {
      await fs.promises.rm(this.tempDir, { recursive: true, force: true });

      // Try to remove parent temp directory if empty
      const parentTempDir = path.dirname(this.tempDir);
      try {
        await fs.promises.rmdir(parentTempDir);
      } catch {
        // Ignore errors - directory might not be empty
      }
    } catch (error) {
      console.error('Failed to clean up temporary directory:', error);
    }
  }
}

/**
 * Create an archive for a test run
 */
export async function createArchive(
  run: TestRun,
  results: TestResult[],
  outputDir: string = '.'
): Promise<string> {
  const archiver = new IbutsuArchiver(run.id, outputDir);
  return await archiver.create(run, results);
}
