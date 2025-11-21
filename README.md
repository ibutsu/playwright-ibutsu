# playwright-ibutsu

A Playwright test reporter for uploading test results to [Ibutsu](https://github.com/ibutsu/ibutsu-server).


[![pre-commit.ci status](https://results.pre-commit.ci/badge/github/ibutsu/playwright-ibutsu/main.svg)](https://results.pre-commit.ci/latest/github/ibutsu/playwright-ibutsu/main)
[![codecov](https://codecov.io/gh/ibutsu/playwright-ibutsu/branch/main/graph/badge.svg)](https://codecov.io/gh/ibutsu/playwright-ibutsu)


## Features

- Upload test results and artifacts to Ibutsu server
- Create local archives of test runs (tar.gz format)
- Upload archives to AWS S3
- Automatic artifact collection on test failures:
  - Screenshots
  - Playwright traces
  - Videos
  - Console logs
  - Error logs
- Configurable via environment variables or `playwright.config.ts`
- Retry logic for network failures
- Supports multiple operating modes (server, archive, or both)

## Installation

```bash
yarn add playwright-ibutsu
```

Or with npm:

```bash
npm install playwright-ibutsu
```

## Configuration

This plugin follows the same configuration pattern as [pytest-ibutsu](https://github.com/ibutsu/pytest-ibutsu) for consistency across test frameworks.

### Environment Variables

**Required for server upload:**
- `IBUTSU_MODE` - Can be:
  - `archive` - Create local archive only
  - `s3` - Create archive and upload to S3
  - A server URL (e.g., `https://ibutsu.example.com` or `http://localhost:8080/api`) - Upload to server
- `IBUTSU_TOKEN` - Authentication token (MUST be set via environment variable for security, required for server mode)
- `IBUTSU_PROJECT` - Project ID or name (required for server mode)

**Optional:**
- `IBUTSU_SOURCE` - Source identifier for the test run (default: `'local'`)
- `IBUTSU_NO_ARCHIVE` - Set to `true` to disable archive creation
- `IBUTSU_COMPONENT` - Component being tested
- `IBUTSU_ENV` - Environment identifier
- `AWS_BUCKET` - S3 bucket name (required for S3 mode)
- `AWS_REGION` - AWS region (default: `us-east-1`)
- `AWS_ACCESS_KEY_ID` - AWS access key (required for S3 mode)
- `AWS_SECRET_ACCESS_KEY` - AWS secret key (required for S3 mode)

### Playwright Configuration

Add the reporter to your `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['playwright-ibutsu', {
      // Non-sensitive configuration options
      source: 'my-test-suite',
      project: 'my-project',
      component: 'frontend',
      env: 'staging',
      mode: process.env.IBUTSU_MODE || 'archive', // URL, 'archive', or 's3'
      metadata: {
        team: 'qa',
        build_id: process.env.BUILD_ID,
      },
    }],
    ['html'], // You can use multiple reporters
  ],
  // ... other config
});
```

**IMPORTANT SECURITY NOTE:** Never put your `IBUTSU_TOKEN` in the configuration file. Always use environment variables:

```bash
export IBUTSU_TOKEN="your-secret-token"
export IBUTSU_MODE="https://ibutsu.example.com"
npx playwright test
```

## Usage Examples

### Upload to Ibutsu Server

```bash
export IBUTSU_MODE=https://ibutsu.example.com
export IBUTSU_TOKEN=your-secret-token
export IBUTSU_PROJECT=my-project
export IBUTSU_SOURCE=my-tests

npx playwright test
```

### Upload to Local Ibutsu Server

```bash
export IBUTSU_MODE=http://localhost:8080/api
export IBUTSU_TOKEN=your-secret-token
export IBUTSU_PROJECT=my-project
export IBUTSU_SOURCE=my-tests

npx playwright test
```

### Create Local Archives Only

```bash
export IBUTSU_MODE=archive
export IBUTSU_SOURCE=my-tests

npx playwright test
```

### Create Archive and Upload to S3

```bash
export IBUTSU_MODE=s3
export IBUTSU_SOURCE=my-tests
export AWS_BUCKET=my-test-archives
export AWS_ACCESS_KEY_ID=your-aws-key
export AWS_SECRET_ACCESS_KEY=your-aws-secret

npx playwright test
```

### CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Playwright Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Run Playwright tests
        env:
          IBUTSU_MODE: https://ibutsu.example.com
          IBUTSU_TOKEN: ${{ secrets.IBUTSU_TOKEN }}
          IBUTSU_SOURCE: ${{ github.repository }}
          IBUTSU_PROJECT: my-project
        run: npx playwright test
```

## Operating Modes

The `IBUTSU_MODE` environment variable determines how the reporter operates:

### Server Mode (URL)
When `IBUTSU_MODE` is set to a URL (e.g., `https://ibutsu.example.com` or `http://localhost:8080/api`):
- Uploads results and artifacts directly to the Ibutsu server
- Requires `IBUTSU_TOKEN` and `IBUTSU_PROJECT`
- Creates a local archive that is then uploaded to the server

### Archive Mode
When `IBUTSU_MODE=archive`:
- Creates local `.tar.gz` archives containing results and artifacts
- Archive structure: `{run-id}.tar.gz` containing:
  - `{run-id}/run.json` - Run metadata
  - `{run-id}/{result-id}/result.json` - Result metadata
  - `{run-id}/{result-id}/*` - Artifacts (screenshots, traces, logs)
- No server upload is performed

### S3 Mode
When `IBUTSU_MODE=s3`:
- Creates local archives (same as archive mode)
- Uploads archives to AWS S3
- Requires `AWS_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`

## Artifacts

The reporter automatically collects artifacts from failed tests:

- **Screenshots**: All images attached to test results
- **Traces**: Playwright trace files (`.zip`)
- **Videos**: Test execution videos (`.webm`)
- **Logs**:
  - Error logs from test failures
  - stdout/stderr output
  - Browser console logs

## API

You can also use the reporter programmatically:

```typescript
import { IbutsuReporter } from 'playwright-ibutsu';

// Create reporter instance for server upload
const reporter = new IbutsuReporter({
  source: 'my-tests',
  project: 'my-project',
  mode: 'https://ibutsu.example.com',
});

// Or for archive mode
const archiveReporter = new IbutsuReporter({
  source: 'my-tests',
  mode: 'archive',
});
```

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT

## Related Projects

- [ibutsu-server](https://github.com/ibutsu/ibutsu-server) - The Ibutsu backend server
- [pytest-ibutsu](https://github.com/ibutsu/pytest-ibutsu) - Pytest plugin for Ibutsu
- [ibutsu-client-ts](https://github.com/ibutsu/ibutsu-client-javascript) - TypeScript client for Ibutsu API
