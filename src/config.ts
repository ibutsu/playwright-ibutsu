import type { IbutsuReporterConfig } from './types';

/**
 * Get configuration from both environment variables and reporter config
 * Priority: Environment variables > Reporter config
 *
 * Following pytest-ibutsu pattern:
 * - IBUTSU_MODE can be 'archive', 's3', or a server URL
 * - IBUTSU_TOKEN must come from environment variable only (security)
 */
export function getConfig(reporterConfig: IbutsuReporterConfig = {}): IbutsuReporterConfig {
  // Validate that token is not in config file (security)
  if (reporterConfig.token !== undefined && reporterConfig.token.length > 0) {
    throw new Error(
      'SECURITY ERROR: IBUTSU_TOKEN must not be stored in playwright.config.ts. ' +
        'Please use the IBUTSU_TOKEN environment variable instead.'
    );
  }

  // Get token from environment only (security requirement)
  const token = process.env.IBUTSU_TOKEN;

  // Build final configuration with priority: env vars > config file
  const config: IbutsuReporterConfig = {
    // Mode configuration - can be 'archive', 's3', or a server URL
    mode: process.env.IBUTSU_MODE ?? reporterConfig.mode,
    token: token, // Only from environment
    source: process.env.IBUTSU_SOURCE ?? reporterConfig.source,
    project: process.env.IBUTSU_PROJECT ?? reporterConfig.project,

    // Archive configuration
    noArchive: process.env.IBUTSU_NO_ARCHIVE === 'true' || reporterConfig.noArchive === true,

    // S3 configuration
    s3Bucket: process.env.AWS_BUCKET ?? reporterConfig.s3Bucket,
    s3Region: process.env.AWS_REGION ?? reporterConfig.s3Region,

    // Additional metadata
    metadata: reporterConfig.metadata ?? {},
    component: process.env.IBUTSU_COMPONENT ?? reporterConfig.component,
    env: process.env.IBUTSU_ENV ?? reporterConfig.env,
  };

  return config;
}

/**
 * Check if mode is 'archive'
 */
export function isArchiveMode(config: IbutsuReporterConfig): boolean {
  return config.mode === 'archive';
}

/**
 * Check if mode is 's3'
 */
export function isS3Mode(config: IbutsuReporterConfig): boolean {
  return config.mode === 's3';
}

/**
 * Check if mode is a server URL (not 'archive' or 's3')
 */
export function isServerMode(config: IbutsuReporterConfig): boolean {
  const mode = config.mode;
  return mode !== undefined && mode.length > 0 && mode !== 'archive' && mode !== 's3';
}

/**
 * Get the server URL from the mode (when in server mode)
 */
export function getServerUrl(config: IbutsuReporterConfig): string | undefined {
  if (!isServerMode(config) || config.mode === undefined) {
    return undefined;
  }

  let serverUrl = config.mode;

  // Remove trailing slash
  if (serverUrl.endsWith('/')) {
    serverUrl = serverUrl.slice(0, -1);
  }

  // Add /api if not present
  if (!serverUrl.endsWith('/api')) {
    serverUrl = `${serverUrl}/api`;
  }

  return serverUrl;
}

/**
 * Validate configuration and check for required fields based on mode
 */
export function validateConfig(config: IbutsuReporterConfig): void {
  // If mode is a server URL, validate server configuration
  if (isServerMode(config)) {
    if (config.token === undefined || config.token.length === 0) {
      throw new Error(
        'IBUTSU_TOKEN is required when IBUTSU_MODE is a server URL. ' +
          'Set it via the IBUTSU_TOKEN environment variable.'
      );
    }

    if (config.project === undefined || config.project.length === 0) {
      throw new Error(
        'IBUTSU_PROJECT is required when IBUTSU_MODE is a server URL. ' +
          'Set it via environment variable or reporter config.'
      );
    }
  }
}

/**
 * Check if archiving should be enabled based on configuration
 */
export function shouldCreateArchive(config: IbutsuReporterConfig): boolean {
  // Archive is created when:
  // 1. mode is 'archive' or 's3', OR
  // 2. mode is a server URL (to create archive before upload)
  // AND noArchive is not set to true
  const mode = config.mode;
  const shouldArchive = mode !== undefined && mode.length > 0;
  return config.noArchive !== true && shouldArchive;
}

/**
 * Check if server upload should be enabled based on configuration
 */
export function shouldUploadToServer(config: IbutsuReporterConfig): boolean {
  return isServerMode(config);
}

/**
 * Check if S3 upload should be enabled based on configuration
 */
export function shouldUploadToS3(config: IbutsuReporterConfig): boolean {
  // S3 upload is enabled when mode is 's3' AND bucket/credentials are configured
  const hasBucket = config.s3Bucket !== undefined && config.s3Bucket.length > 0;
  const hasCredentials =
    (process.env.AWS_ACCESS_KEY_ID !== undefined && process.env.AWS_ACCESS_KEY_ID.length > 0) ||
    (process.env.AWS_PROFILE !== undefined && process.env.AWS_PROFILE.length > 0);
  return isS3Mode(config) && hasBucket && hasCredentials;
}
