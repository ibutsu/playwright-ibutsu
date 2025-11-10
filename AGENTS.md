- Use `npm` or `yarn` for interacting with the project's building and package management
- Use `yarn run lint` or `yarn run lint:fix` to check and auto-fix lint issues
- Use `yarn run format` or `yarn run format:check` for code formatting with Prettier
- Automatically work to resolve failures in the lint and format output
- Do not include excessive emoji in readme, contributing, and other documentation files

## Testing instructions
- From the package root you can run `yarn test` or `yarn run test:coverage`
- The commit should pass all tests before proceeding
- Add or update tests for the code you change, even if nobody asked

## Building
- Build the project with `yarn run build`
- The TypeScript compiler will output to the `dist/` directory

## Pre-commit hooks
- Run `yarn run precommit` to execute linting and formatting
- Pre-commit hooks will automatically run on commit if configured
