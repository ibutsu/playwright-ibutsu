import { v4 as uuidv4 } from 'uuid';

/**
 * Summary statistics for a test run
 */
export interface Summary {
  failures: number;
  errors: number;
  xfailures: number;
  xpasses: number;
  skips: number;
  tests: number;
  collected: number;
  not_run: number;
}

/**
 * Represents a test run in Ibutsu
 */
export interface IbutsuTestRun {
  id: string;
  component?: string;
  env?: string;
  metadata: Record<string, unknown>;
  source?: string;
  start_time: string;
  duration: number;
  summary: Summary;
}

/**
 * Represents a test result in Ibutsu
 */
export interface IbutsuTestResult {
  id: string;
  test_id: string;
  result: 'passed' | 'failed' | 'skipped' | 'error' | 'xfailed' | 'xpassed';
  duration: number;
  start_time: string;
  metadata: Record<string, unknown>;
  params?: Record<string, unknown>;
}

/**
 * Configuration options for the Ibutsu reporter
 *
 * Following pytest-ibutsu pattern:
 * - mode: 'archive', 's3', or a URL for server upload
 * - If mode is a URL, it's treated as the server URL
 * - token is required when mode is a URL (server mode)
 */
export interface IbutsuReporterConfig {
  // Mode configuration - can be 'archive', 's3', or a server URL
  mode?: string;
  token?: string;
  source?: string;
  project?: string;

  // Archive configuration
  noArchive?: boolean;

  // S3 configuration
  s3Bucket?: string;
  s3Region?: string;

  // Additional metadata
  metadata?: Record<string, unknown>;
  component?: string;
  env?: string;
}

/**
 * Internal artifact storage
 */
export type ArtifactMap = Record<string, Buffer | string>;

/**
 * Test run class with helper methods
 */
export class TestRun implements IbutsuTestRun {
  id: string;
  component?: string;
  env?: string;
  metadata: Record<string, unknown>;
  source?: string;
  start_time: string;
  duration: number;
  summary: Summary;
  private _artifacts: ArtifactMap = {};
  private _start_unix_time = 0;

  constructor(config: Partial<IbutsuTestRun> = {}) {
    this.id = config.id ?? uuidv4();
    this.component = config.component;
    this.env = config.env ?? process.env.IBUTSU_ENV_ID;
    this.metadata = config.metadata ?? {};
    this.source = config.source;
    this.start_time = config.start_time ?? '';
    this.duration = config.duration ?? 0;
    this.summary = config.summary ?? {
      failures: 0,
      errors: 0,
      xfailures: 0,
      xpasses: 0,
      skips: 0,
      tests: 0,
      collected: 0,
      not_run: 0,
    };

    // Add Jenkins metadata if available
    const jobName = process.env.JOB_NAME;
    const buildNumber = process.env.BUILD_NUMBER;
    if (
      jobName !== undefined &&
      jobName.length > 0 &&
      buildNumber !== undefined &&
      buildNumber.length > 0
    ) {
      this.metadata.jenkins = {
        job_name: jobName,
        build_number: buildNumber,
        build_url: process.env.BUILD_URL,
      };
    }

    const envId = process.env.IBUTSU_ENV_ID;
    if (envId !== undefined && envId.length > 0) {
      this.metadata.env_id = envId;
    }
  }

  startTimer(): void {
    this._start_unix_time = Date.now();
    this.start_time = new Date().toISOString();
  }

  stopTimer(): void {
    if (this._start_unix_time > 0) {
      this.duration = (Date.now() - this._start_unix_time) / 1000;
    }
  }

  addArtifact(filename: string, data: Buffer | string): void {
    this._artifacts[filename] = data;
  }

  getArtifacts(): ArtifactMap {
    return { ...this._artifacts };
  }

  toDict(): IbutsuTestRun {
    return {
      id: this.id,
      component: this.component,
      env: this.env,
      metadata: this.metadata,
      source: this.source,
      start_time: this.start_time,
      duration: this.duration,
      summary: this.summary,
    };
  }
}

/**
 * Test result class with helper methods
 */
export class TestResult implements IbutsuTestResult {
  id: string;
  test_id: string;
  result: 'passed' | 'failed' | 'skipped' | 'error' | 'xfailed' | 'xpassed';
  duration: number;
  start_time: string;
  metadata: Record<string, unknown>;
  params?: Record<string, unknown>;
  private _artifacts: ArtifactMap = {};
  private _start_unix_time = 0;

  constructor(config: Partial<IbutsuTestResult> & { test_id: string }) {
    this.id = config.id ?? uuidv4();
    this.test_id = config.test_id;
    this.result = config.result ?? 'passed';
    this.duration = config.duration ?? 0;
    this.start_time = config.start_time ?? '';
    this.metadata = config.metadata ?? {};
    this.params = config.params;
  }

  startTimer(): void {
    this._start_unix_time = Date.now();
    this.start_time = new Date().toISOString();
  }

  stopTimer(): void {
    if (this._start_unix_time > 0) {
      this.duration = (Date.now() - this._start_unix_time) / 1000;
    }
  }

  addArtifact(filename: string, data: Buffer | string): void {
    this._artifacts[filename] = data;
  }

  getArtifacts(): ArtifactMap {
    return { ...this._artifacts };
  }

  toDict(): IbutsuTestResult {
    return {
      id: this.id,
      test_id: this.test_id,
      result: this.result,
      duration: this.duration,
      start_time: this.start_time,
      metadata: this.metadata,
      params: this.params,
    };
  }
}

/**
 * Utility to validate UUID strings
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(uuid);
}
