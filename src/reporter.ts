import {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult as PlaywrightTestResult,
  FullResult,
  TestError,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import { TestRun, TestResult, IbutsuReporterConfig } from './types';
import {
  getConfig,
  validateConfig,
  shouldCreateArchive,
  shouldUploadToServer,
  shouldUploadToS3,
} from './config';
import { createArchive } from './archiver';
import { sendToServer } from './sender';
import { uploadToS3 } from './s3-uploader';

/**
 * Playwright Ibutsu Reporter
 *
 * Reports test results to an Ibutsu server and/or creates local archives
 */
export default class IbutsuReporter implements Reporter {
  private config: IbutsuReporterConfig;
  private run!: TestRun;
  private results: Map<string, TestResult> = new Map();
  private enabled: boolean = true;

  constructor(options: IbutsuReporterConfig = {}) {
    try {
      this.config = getConfig(options);
      validateConfig(this.config);
    } catch (error) {
      console.error('Ibutsu Reporter configuration error:', error);
      this.enabled = false;
      this.config = options;
    }
  }

  /**
   * Called once before running tests
   */
  onBegin(config: FullConfig, suite: Suite): void {
    if (!this.enabled) {
      return;
    }

    console.log('Ibutsu Reporter: Starting test run');

    // Initialize test run
    this.run = new TestRun({
      source: this.config.source,
      component: this.config.component,
      env: this.config.env,
      metadata: {
        ...this.config.metadata,
        playwright: {
          version: config.version,
          workers: config.workers,
          projects: config.projects.map((p) => p.name),
        },
      },
    });

    this.run.startTimer();
    this.results.clear();
  }

  /**
   * Called for each test
   */
  onTestEnd(test: TestCase, result: PlaywrightTestResult): void {
    if (!this.enabled) {
      return;
    }

    // Map Playwright status to Ibutsu status
    const ibutsuStatus = this.mapStatus(result.status);

    // Create test result
    const testResult = new TestResult({
      test_id: this.getTestId(test),
      result: ibutsuStatus,
      metadata: {
        title: test.title,
        location: test.location,
        project: test.parent.project()?.name,
        retries: result.retry,
        ...this.extractMetadata(test),
      },
    });

    testResult.startTimer();
    testResult.duration = result.duration / 1000; // Convert ms to seconds
    testResult.start_time = result.startTime.toISOString();

    // Collect artifacts on failure
    if (result.status === 'failed' || result.status === 'timedOut') {
      this.collectArtifacts(test, result, testResult);
    }

    // Update run summary
    this.updateSummary(ibutsuStatus);

    // Store result
    this.results.set(testResult.id, testResult);
  }

  /**
   * Called after all tests are done
   */
  async onEnd(result: FullResult): Promise<void> {
    if (!this.enabled) {
      return;
    }

    this.run.stopTimer();

    console.log('\nIbutsu Reporter: Test run completed');
    console.log(`  Total tests: ${this.results.size}`);
    console.log(`  Duration: ${this.run.duration.toFixed(2)}s`);
    console.log(`  Summary: ${JSON.stringify(this.run.summary)}`);

    const resultsArray = Array.from(this.results.values());

    try {
      // Create archive if needed
      if (shouldCreateArchive(this.config)) {
        await this.createLocalArchive(resultsArray);
      }

      // Upload to server if needed
      if (shouldUploadToServer(this.config)) {
        await this.uploadToServer(resultsArray);
      }

      // Upload to S3 if needed
      if (shouldUploadToS3(this.config)) {
        await this.uploadToS3();
      }
    } catch (error) {
      console.error('Ibutsu Reporter: Error during finalization:', error);
    }
  }

  /**
   * Called on unhandled errors
   */
  onError(error: TestError): void {
    console.error('Ibutsu Reporter: Unhandled error:', error);
  }

  /**
   * Map Playwright status to Ibutsu status
   */
  private mapStatus(
    status: string
  ): 'passed' | 'failed' | 'skipped' | 'error' | 'xfailed' | 'xpassed' {
    switch (status) {
      case 'passed':
        return 'passed';
      case 'failed':
      case 'timedOut':
        return 'failed';
      case 'skipped':
        return 'skipped';
      case 'interrupted':
        return 'error';
      default:
        return 'error';
    }
  }

  /**
   * Get unique test ID
   */
  private getTestId(test: TestCase): string {
    const projectName = test.parent.project()?.name || 'default';
    const titlePath = test.titlePath().join(' › ');
    return `${projectName}::${titlePath}`;
  }

  /**
   * Extract metadata from test
   */
  private extractMetadata(test: TestCase): Record<string, unknown> {
    return {
      annotations: test.annotations,
      tags: test.tags,
      titlePath: test.titlePath(),
    };
  }

  /**
   * Collect artifacts from failed test
   */
  private collectArtifacts(
    test: TestCase,
    result: PlaywrightTestResult,
    testResult: TestResult
  ): void {
    // Collect screenshots
    for (const attachment of result.attachments) {
      if (attachment.contentType.startsWith('image/')) {
        const filename = attachment.name || 'screenshot.png';
        if (attachment.body) {
          testResult.addArtifact(filename, attachment.body);
        } else if (attachment.path) {
          testResult.addArtifact(filename, attachment.path);
        }
      }

      // Collect traces
      if (attachment.name === 'trace' && attachment.path) {
        testResult.addArtifact('trace.zip', attachment.path);
      }

      // Collect videos
      if (attachment.contentType.startsWith('video/') && attachment.path) {
        testResult.addArtifact('video.webm', attachment.path);
      }
    }

    // Collect error logs
    if (result.errors.length > 0) {
      const errorLog = result.errors.map((e) => e.message || e.value).join('\n\n');
      testResult.addArtifact('error.log', errorLog);
    }

    // Collect stdout/stderr
    if (result.stdout.length > 0) {
      const stdout = result.stdout.map((s) => s.toString()).join('\n');
      testResult.addArtifact('stdout.log', stdout);
    }

    if (result.stderr.length > 0) {
      const stderr = result.stderr.map((s) => s.toString()).join('\n');
      testResult.addArtifact('stderr.log', stderr);
    }
  }

  /**
   * Update run summary
   */
  private updateSummary(
    status: 'passed' | 'failed' | 'skipped' | 'error' | 'xfailed' | 'xpassed'
  ): void {
    this.run.summary.tests += 1;
    this.run.summary.collected += 1;

    switch (status) {
      case 'failed':
        this.run.summary.failures += 1;
        break;
      case 'error':
        this.run.summary.errors += 1;
        break;
      case 'skipped':
        this.run.summary.skips += 1;
        break;
      case 'xfailed':
        this.run.summary.xfailures += 1;
        break;
      case 'xpassed':
        this.run.summary.xpasses += 1;
        break;
    }
  }

  /**
   * Create local archive
   */
  private async createLocalArchive(results: TestResult[]): Promise<void> {
    try {
      console.log('\nIbutsu Reporter: Creating archive...');
      const archivePath = await createArchive(this.run, results);
      console.log(`  Archive created: ${archivePath}`);
    } catch (error) {
      console.error('  Failed to create archive:', error);
    }
  }

  /**
   * Upload to Ibutsu server
   */
  private async uploadToServer(results: TestResult[]): Promise<void> {
    if (!this.config.server || !this.config.token) {
      console.error('Ibutsu Reporter: Server URL or token not configured');
      return;
    }

    try {
      console.log('\nIbutsu Reporter: Uploading to server...');
      console.log(`  Server: ${this.config.server}`);

      const { success, errors, frontendUrl } = await sendToServer(
        this.config.server,
        this.config.token,
        this.run,
        results
      );

      if (success) {
        console.log('  Upload successful!');
        if (frontendUrl) {
          console.log(`  View results: ${frontendUrl}/runs/${this.run.id}`);
        }
      } else {
        console.error('  Upload failed with errors:', errors);
      }
    } catch (error) {
      console.error('  Failed to upload to server:', error);
    }
  }

  /**
   * Upload archives to S3
   */
  private async uploadToS3(): Promise<void> {
    try {
      console.log('\nIbutsu Reporter: Uploading to S3...');
      console.log(`  Bucket: ${this.config.s3Bucket}`);

      const urls = await uploadToS3('.', this.config.s3Bucket, this.config.s3Region);

      if (urls.length > 0) {
        console.log(`  Uploaded ${urls.length} file(s) to S3`);
        urls.forEach((url) => console.log(`    ${url}`));
      } else {
        console.log('  No files uploaded to S3');
      }
    } catch (error) {
      console.error('  Failed to upload to S3:', error);
    }
  }
}
