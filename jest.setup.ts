// Mock uuid to avoid ESM issues in Jest
jest.mock('uuid', () => ({
  v4: () => '12345678-1234-4234-8234-123456789012',
}));
