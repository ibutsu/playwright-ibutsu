# playwright-ibutsu

A Playwright test reporter for uploading test results to [Ibutsu](https://github.com/ibutsu/ibutsu-server).


[![pre-commit.ci status](https://results.pre-commit.ci/badge/github/ibutsu/playwright-ibutsu/main.svg)](https://results.pre-commit.ci/latest/github/ibutsu/playwright-ibutsu/main)


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
npm install playwright-ibutsu
```

Or with yarn:

```bash
yarn add playwright-ibutsu
```

## Configuration

### Environment Variables

**Required for server upload:**
- `IBUTSU_SERVER` - Ibutsu server URL (e.g., `https://ibutsu.example.com`)
- `IBUTSU_TOKEN` - Authentication token (MUST be set via environment variable for security)

**Optional:**
- `IBUTSU_SOURCE` - Source identifier for the test run
- `IBUTSU_PROJECT` - Project name
- `IBUTSU_MODE` - Operating mode: `server`, `archive`, or `both` (default: `both`)
- `IBUTSU_NO_ARCHIVE` - Set to `true` to disable archive creation
- `IBUTSU_COMPONENT` - Component being tested
- `IBUTSU_ENV` - Environment identifier
- `AWS_BUCKET` - S3 bucket name for archive uploads
- `AWS_REGION` - AWS region (default: `us-east-1`)
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key

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
      mode: 'both', // 'server', 'archive', or 'both'
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
export IBUTSU_SERVER="https://ibutsu.example.com"
npx playwright test
```

## Usage Examples

### Upload to Ibutsu Server Only

```bash
export IBUTSU_MODE=server
export IBUTSU_SERVER=https://ibutsu.example.com
export IBUTSU_TOKEN=your-secret-token
export IBUTSU_SOURCE=my-tests

npx playwright test
```

### Create Local Archives Only

```bash
export IBUTSU_MODE=archive
export IBUTSU_SOURCE=my-tests

npx playwright test
```

### Upload to Server and S3

```bash
export IBUTSU_MODE=both
export IBUTSU_SERVER=https://ibutsu.example.com
export IBUTSU_TOKEN=your-secret-token
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
        run: npm ci

      - name: Run Playwright tests
        env:
          IBUTSU_SERVER: https://ibutsu.example.com
          IBUTSU_TOKEN: ${{ secrets.IBUTSU_TOKEN }}
          IBUTSU_SOURCE: ${{ github.repository }}
          IBUTSU_PROJECT: my-project
        run: npx playwright test
```

## Operating Modes

### Server Mode
- Uploads results and artifacts directly to Ibutsu server
- Requires `IBUTSU_SERVER` and `IBUTSU_TOKEN`

### Archive Mode
- Creates local `.tar.gz` archives containing results and artifacts
- Archive structure: `{run-id}.tar.gz` containing:
  - `{run-id}/run.json` - Run metadata
  - `{run-id}/{result-id}/result.json` - Result metadata
  - `{run-id}/{result-id}/*` - Artifacts (screenshots, traces, logs)

### Both Mode (Default)
- Uploads to server AND creates local archives
- Archives can be uploaded to S3 if AWS credentials are configured

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

// Create reporter instance
const reporter = new IbutsuReporter({
  source: 'my-tests',
  project: 'my-project',
  mode: 'server',
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
