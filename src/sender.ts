import { Configuration, RunApi, ResultApi, ArtifactApi, HealthApi } from '@ibutsu/client';
import * as fs from 'fs';
import * as path from 'path';
import { TestRun, TestResult, ArtifactMap } from './types';

// Upload limit for artifacts (5 MiB)
const UPLOAD_LIMIT = 5 * 1024 * 1024;

// Retry configuration
const MAX_CALL_RETRIES = 3;
const RETRY_BASE_DELAY = 1000; // 1 second
const RETRY_BACKOFF_FACTOR = 2.0;

// CA bundle environment variables
const CA_BUNDLE_ENVS = ['REQUESTS_CA_BUNDLE', 'IBUTSU_CA_BUNDLE'];

/**
 * Handles artifact data preparation for upload
 */
class ArtifactDataHandler {
  private data: Buffer | string;

  constructor(data: Buffer | string) {
    this.data = data;
  }

  /**
   * Get the size of the artifact
   */
  async getSize(): Promise<number> {
    if (Buffer.isBuffer(this.data)) {
      return this.data.length;
    }

    if (typeof this.data === 'string') {
      // Check if it's a file path
      try {
        const stats = await fs.promises.stat(this.data);
        if (stats.isFile()) {
          return stats.size;
        }
      } catch {
        // Not a file, treat as string content
      }
      return Buffer.byteLength(this.data, 'utf-8');
    }

    return 0;
  }

  /**
   * Check if the artifact size is acceptable
   */
  async isSizeAcceptable(limit: number = UPLOAD_LIMIT): Promise<boolean> {
    const size = await this.getSize();
    return size < limit;
  }

  /**
   * Get the prepared data for upload
   */
  async getPreparedData(): Promise<Buffer> {
    if (Buffer.isBuffer(this.data)) {
      return this.data;
    }

    if (typeof this.data === 'string') {
      // Try to read as file
      try {
        const stats = await fs.promises.stat(this.data);
        if (stats.isFile()) {
          return await fs.promises.readFile(this.data);
        }
      } catch {
        // Not a file, treat as string content
      }
      return Buffer.from(this.data, 'utf-8');
    }

    return Buffer.from('');
  }
}

/**
 * Retry errors that should trigger a retry
 */
const RETRIABLE_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ENETUNREACH',
];

/**
 * Check if an error is retriable
 */
function isRetriableError(error: unknown): boolean {
  if (error instanceof Error) {
    return RETRIABLE_ERRORS.some((code) => error.message.includes(code));
  }
  return false;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sender for uploading results to Ibutsu server
 */
export class IbutsuSender {
  private serverUrl: string;
  private token: string | undefined;
  private runApi: RunApi;
  private resultApi: ResultApi;
  private artifactApi: ArtifactApi;
  private healthApi: HealthApi;
  private hasServerError: boolean = false;
  private serverErrors: string[] = [];

  constructor(serverUrl: string, token?: string) {
    this.serverUrl = serverUrl;
    this.token = token;

    // Configure API client
    const config = new Configuration({
      basePath: serverUrl,
      accessToken: token,
    });

    // Set SSL CA cert if environment variable is set
    for (const envVar of CA_BUNDLE_ENVS) {
      const certPath = process.env[envVar];
      if (certPath) {
        // Note: typescript-fetch doesn't directly support custom CA certs
        // This would need to be handled at the fetch layer
        console.log(`CA bundle found at ${envVar}: ${certPath}`);
        break;
      }
    }

    this.runApi = new RunApi(config);
    this.resultApi = new ResultApi(config);
    this.artifactApi = new ArtifactApi(config);
    this.healthApi = new HealthApi(config);
  }

  /**
   * Get frontend URL from health API
   */
  async getFrontendUrl(): Promise<string | undefined> {
    try {
      const healthInfo = await this.healthApi.getHealthInfo();
      return healthInfo.frontend;
    } catch (error) {
      console.error('Failed to get frontend URL:', error);
      return undefined;
    }
  }

  /**
   * Make an API call with retry logic
   */
  private async makeCall<T>(
    apiMethod: () => Promise<T>,
    methodName: string,
    hideException: boolean = false
  ): Promise<T | null> {
    let retries = 0;

    while (retries < MAX_CALL_RETRIES) {
      try {
        return await apiMethod();
      } catch (error) {
        if (isRetriableError(error)) {
          retries++;
          if (retries < MAX_CALL_RETRIES) {
            const delay = RETRY_BASE_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, retries - 1);
            console.log(
              `Network error (attempt ${retries}/${MAX_CALL_RETRIES}): ${error}. ` +
                `Retrying in ${delay}ms...`
            );
            await sleep(delay);
          } else {
            console.error(
              `Network error (final attempt ${retries}/${MAX_CALL_RETRIES}): ${error}`
            );
            if (!hideException) {
              this.hasServerError = true;
              this.serverErrors.push(String(error));
            }
          }
        } else {
          if (!hideException) {
            console.error(`API call ${methodName} failed:`, error);
            this.hasServerError = true;
            this.serverErrors.push(String(error));
          }
          break;
        }
      }
    }

    return null;
  }

  /**
   * Add or update a test run
   */
  async addOrUpdateRun(run: TestRun): Promise<void> {
    const runData = run.toDict();

    // Try to get existing run
    const existingRun = await this.makeCall(
      () => this.runApi.getRun({ id: run.id }),
      'getRun',
      true
    );

    if (existingRun) {
      // Update existing run
      await this.makeCall(
        () => this.runApi.updateRun({ id: run.id, run: runData }),
        'updateRun'
      );
    } else {
      // Add new run
      await this.makeCall(() => this.runApi.addRun({ run: runData }), 'addRun');
    }
  }

  /**
   * Add a test result
   */
  async addResult(result: TestResult): Promise<void> {
    const resultData = result.toDict();
    await this.makeCall(() => this.resultApi.addResult({ result: resultData }), 'addResult');
  }

  /**
   * Upload an artifact
   */
  private async uploadArtifact(
    id: string,
    filename: string,
    data: Buffer | string,
    isRun: boolean = false
  ): Promise<void> {
    try {
      const handler = new ArtifactDataHandler(data);

      // Check size
      if (!(await handler.isSizeAcceptable())) {
        console.error(`Artifact ${filename} size exceeds upload limit`);
        return;
      }

      // Prepare data
      const preparedData = await handler.getPreparedData();

      // Upload artifact
      const params = isRun ? { runId: id } : { resultId: id };

      await this.makeCall(
        () =>
          this.artifactApi.uploadArtifact({
            filename,
            file: preparedData,
            ...params,
          }),
        'uploadArtifact'
      );
    } catch (error) {
      console.error(`Failed to upload artifact ${filename}:`, error);
    }
  }

  /**
   * Upload artifacts for a run or result
   */
  async uploadArtifacts(
    id: string,
    artifacts: ArtifactMap,
    isRun: boolean = false
  ): Promise<void> {
    for (const [filename, data] of Object.entries(artifacts)) {
      try {
        await this.uploadArtifact(id, filename, data, isRun);
      } catch (error) {
        console.error(`Uploading artifact ${filename} failed, continuing...`, error);
      }
    }
  }

  /**
   * Send all test data to the server
   */
  async sendData(run: TestRun, results: TestResult[]): Promise<boolean> {
    try {
      // Upload run
      await this.addOrUpdateRun(run);
      await this.uploadArtifacts(run.id, run.getArtifacts(), true);

      // Upload results
      for (const result of results) {
        await this.addResult(result);
        await this.uploadArtifacts(result.id, result.getArtifacts(), false);
      }

      // Final run update to trigger server-side processing
      await this.addOrUpdateRun(run);

      return !this.hasServerError;
    } catch (error) {
      console.error('Failed to send data to Ibutsu server:', error);
      this.hasServerError = true;
      this.serverErrors.push(String(error));
      return false;
    }
  }

  /**
   * Check if there were any server errors
   */
  hasErrors(): boolean {
    return this.hasServerError;
  }

  /**
   * Get all server errors
   */
  getErrors(): string[] {
    return [...this.serverErrors];
  }
}

/**
 * Send test data to Ibutsu server
 */
export async function sendToServer(
  serverUrl: string,
  token: string | undefined,
  run: TestRun,
  results: TestResult[]
): Promise<{ success: boolean; errors: string[]; frontendUrl?: string }> {
  const sender = new IbutsuSender(serverUrl, token);
  const success = await sender.sendData(run, results);
  const errors = sender.getErrors();
  const frontendUrl = await sender.getFrontendUrl();

  return { success, errors, frontendUrl };
}
