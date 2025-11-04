import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { isValidUUID } from './types';

/**
 * S3 Uploader for Ibutsu test archives
 */
export class S3Uploader {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(bucketName?: string, region?: string) {
    this.bucketName = bucketName || process.env.AWS_BUCKET || '';
    
    if (!this.bucketName) {
      throw new Error(
        'AWS bucket name is required. Set AWS_BUCKET environment variable or pass bucketName parameter.'
      );
    }

    // Create S3 client - automatically uses AWS credentials from:
    // - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)
    // - AWS credentials file (~/.aws/credentials)
    // - EC2 instance profile
    // - AWS IAM role
    this.s3Client = new S3Client({
      region: region || process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Find UUID.tar.gz files in a directory
   */
  async findUuidTarGzFiles(directory: string = '.'): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(directory);
      return files
        .filter((file) => {
          if (!file.endsWith('.tar.gz')) {
            return false;
          }
          const baseName = file.slice(0, -7); // Remove .tar.gz
          return isValidUUID(baseName);
        })
        .map((file) => path.join(directory, file));
    } catch (error) {
      console.error(`Error reading directory ${directory}:`, error);
      return [];
    }
  }

  /**
   * Check if a file with the same name and size already exists in S3
   */
  private async fileExistsInS3(key: string, localFileSize: number): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const response = await this.s3Client.send(command);
      const s3FileSize = response.ContentLength || 0;
      return s3FileSize === localFileSize;
    } catch (error: unknown) {
      // If the file doesn't exist, HeadObject throws an error
      if (error instanceof Error && error.name === 'NotFound') {
        return false;
      }
      console.warn(`Error checking S3 file existence for ${key}:`, error);
      return false;
    }
  }

  /**
   * Upload a single file to S3
   */
  async uploadFile(filePath: string, key?: string): Promise<string | null> {
    try {
      // Check if file exists
      const stats = await fs.promises.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`${filePath} is not a file`);
      }

      const s3Key = key || path.basename(filePath);
      const localFileSize = stats.size;
      const s3Url = `s3://${this.bucketName}/${s3Key}`;

      // Check if file already exists in S3 with same size
      if (await this.fileExistsInS3(s3Key, localFileSize)) {
        console.log(`Skipping ${filePath}, exists in S3 with same size: ${s3Url}`);
        return null;
      }

      console.log(`Uploading ${filePath} to ${this.bucketName}/${s3Key}`);

      // Read file and upload
      const fileContent = await fs.promises.readFile(filePath);
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileContent,
        ServerSideEncryption: 'AES256',
      });

      await this.s3Client.send(command);
      console.log(`Upload complete: ${s3Url}`);

      return s3Url;
    } catch (error) {
      console.error(`Failed to upload ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Upload multiple archive files from a directory
   */
  async uploadArchives(directory: string = '.'): Promise<string[]> {
    console.log(`Scanning ${directory} for UUID.tar.gz files`);
    const files = await this.findUuidTarGzFiles(directory);

    if (files.length === 0) {
      console.log(`No UUID.tar.gz files found in ${directory}`);
      return [];
    }

    const uploadedUrls: string[] = [];
    const errors: string[] = [];

    for (const filePath of files) {
      try {
        const s3Url = await this.uploadFile(filePath);
        if (s3Url) {
          uploadedUrls.push(s3Url);
        }
      } catch (error) {
        console.error(`Failed to upload ${filePath}, continuing...`, error);
        errors.push(filePath);
      }
    }

    console.log(
      `Successfully uploaded ${uploadedUrls.length} out of ${files.length} files`
    );

    if (errors.length > 0) {
      console.error(`Failed to upload ${errors.length} files:`, errors);
    }

    return uploadedUrls;
  }
}

/**
 * Upload archives to S3
 */
export async function uploadToS3(
  directory: string = '.',
  bucketName?: string,
  region?: string
): Promise<string[]> {
  try {
    const uploader = new S3Uploader(bucketName, region);
    return await uploader.uploadArchives(directory);
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

