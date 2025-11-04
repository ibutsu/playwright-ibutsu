import { IbutsuReporterConfig } from './types';

/**
 * Get configuration from both environment variables and reporter config
 * Priority: Environment variables > Reporter config
 *
 * SECURITY: IBUTSU_TOKEN must come from environment variable only
 */
export function getConfig(reporterConfig: IbutsuReporterConfig = {}): IbutsuReporterConfig {
  // Validate that token is not in config file (security)
  if (reporterConfig.token) {
    throw new Error(
      'SECURITY ERROR: IBUTSU_TOKEN must not be stored in playwright.config.ts. ' +
        'Please use the IBUTSU_TOKEN environment variable instead.'
    );
  }

  // Get token from environment only (security requirement)
  const token = process.env.IBUTSU_TOKEN;

  // Build final configuration with priority: env vars > config file
  const config: IbutsuReporterConfig = {
    // Server configuration
    server: process.env.IBUTSU_SERVER || reporterConfig.server,
    token: token, // Only from environment
    source: process.env.IBUTSU_SOURCE || reporterConfig.source,
    project: process.env.IBUTSU_PROJECT || reporterConfig.project,

    // Mode configuration
    mode: (process.env.IBUTSU_MODE as 'server' | 'archive' | 'both') || reporterConfig.mode || 'both',
    noArchive: process.env.IBUTSU_NO_ARCHIVE === 'true' || reporterConfig.noArchive || false,

    // S3 configuration
    s3Bucket: process.env.AWS_BUCKET || reporterConfig.s3Bucket,
    s3Region: process.env.AWS_REGION || reporterConfig.s3Region,

    // Additional metadata
    metadata: reporterConfig.metadata || {},
    component: process.env.IBUTSU_COMPONENT || reporterConfig.component,
    env: process.env.IBUTSU_ENV || reporterConfig.env,
  };

  return config;
}

/**
 * Validate configuration and check for required fields based on mode
 */
export function validateConfig(config: IbutsuReporterConfig): void {
  const mode = config.mode || 'both';

  // If mode includes 'server', validate server configuration
  if (mode === 'server' || mode === 'both') {
    if (!config.server) {
      throw new Error(
        'IBUTSU_SERVER is required when mode is "server" or "both". ' +
          'Set it via environment variable or reporter config.'
      );
    }

    if (!config.token) {
      throw new Error(
        'IBUTSU_TOKEN is required when mode is "server" or "both". ' +
          'Set it via the IBUTSU_TOKEN environment variable.'
      );
    }
  }

  // Normalize server URL
  if (config.server) {
    let server = config.server;
    // Remove trailing slash
    if (server.endsWith('/')) {
      server = server.slice(0, -1);
    }
    // Add /api if not present
    if (!server.endsWith('/api')) {
      server = `${server}/api`;
    }
    config.server = server;
  }
}

/**
 * Check if archiving should be enabled based on configuration
 */
export function shouldCreateArchive(config: IbutsuReporterConfig): boolean {
  const mode = config.mode || 'both';
  return !config.noArchive && (mode === 'archive' || mode === 'both');
}

/**
 * Check if server upload should be enabled based on configuration
 */
export function shouldUploadToServer(config: IbutsuReporterConfig): boolean {
  const mode = config.mode || 'both';
  return mode === 'server' || mode === 'both';
}

/**
 * Check if S3 upload should be enabled based on configuration
 */
export function shouldUploadToS3(config: IbutsuReporterConfig): boolean {
  return !!(config.s3Bucket && (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE));
}
