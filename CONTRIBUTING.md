# Contributing to playwright-ibutsu

Thank you for your interest in contributing to playwright-ibutsu!

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Git

### Getting Started

1. Fork and clone the repository:
```bash
git clone https://github.com/your-username/playwright-ibutsu.git
cd playwright-ibutsu
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Run tests:
```bash
npm test
```

## Project Structure

```
playwright-ibutsu/
├── src/
│   ├── reporter.ts      # Main Playwright reporter implementation
│   ├── types.ts         # TypeScript interfaces and models
│   ├── config.ts        # Configuration handling
│   ├── archiver.ts      # Archive creation (tar.gz)
│   ├── sender.ts        # Server upload functionality
│   ├── s3-uploader.ts   # S3 upload functionality
│   └── index.ts         # Public API exports
├── test/                # Unit tests
├── dist/                # Compiled output (generated)
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## Development Workflow

### Making Changes

1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and ensure they follow our coding standards

3. Run linting and formatting:
```bash
npm run lint:fix
npm run format
```

4. Run tests:
```bash
npm test
npm run test:coverage
```

5. Build the project:
```bash
npm run build
```

### Code Style

- **TypeScript**: We use TypeScript with strict type checking
- **ESLint**: Configured with `@typescript-eslint` rules
- **Prettier**: For consistent code formatting
- **Conventions**:
  - Use `camelCase` for variables and functions
  - Use `PascalCase` for classes and interfaces
  - Use explicit return types for functions
  - Avoid `any` types when possible

### Testing

- Write unit tests for new functionality
- Place tests in the `test/` directory
- Test files should be named `*.test.ts`
- Aim for >70% code coverage
- Run tests with: `npm test`
- Run with coverage: `npm run test:coverage`

### Pre-commit Hooks

We use pre-commit hooks to ensure code quality. Install them with:

```bash
pip install pre-commit
pre-commit install
```

Or run manually:
```bash
npm run precommit
```

## Submitting Changes

### Pull Request Process

1. Ensure all tests pass and code is formatted
2. Update documentation if needed
3. Add/update tests for your changes
4. Commit your changes with clear, descriptive messages
5. Push to your fork and submit a pull request

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(reporter): add support for custom metadata
fix(archiver): handle missing artifact files gracefully
docs(readme): update configuration examples
```

### Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Reference any related issues
- Update CHANGELOG.md if applicable
- Ensure CI checks pass
- Request review from maintainers

## Testing Your Changes

### Manual Testing

To test your changes with a real Playwright project:

1. Build the reporter:
```bash
npm run build
```

2. Link it locally:
```bash
npm link
```

3. In your test project:
```bash
npm link playwright-ibutsu
```

4. Add the reporter to your `playwright.config.ts` and run tests

### Integration Testing

If you have access to an Ibutsu server:

```bash
export IBUTSU_SERVER=https://your-server.com
export IBUTSU_TOKEN=your-token
export IBUTSU_MODE=server
export IBUTSU_SOURCE=test-run

# Run your Playwright tests
npx playwright test
```

## Release Process

(For maintainers only)

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create a git tag:
```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```
4. Create a GitHub release
5. The GitHub Action will automatically publish to npm

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues and PRs first
- Ask questions in issue discussions

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help make the project welcoming to all

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

