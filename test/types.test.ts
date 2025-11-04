import { TestRun, TestResult, isValidUUID } from '../src/types';

describe('TestRun', () => {
  it('should create a test run with default values', () => {
    const run = new TestRun();
    expect(run.id).toBeDefined();
    expect(isValidUUID(run.id)).toBe(true);
    expect(run.duration).toBe(0);
    expect(run.summary).toEqual({
      failures: 0,
      errors: 0,
      xfailures: 0,
      xpasses: 0,
      skips: 0,
      tests: 0,
      collected: 0,
      not_run: 0,
    });
  });

  it('should start and stop timer', () => {
    const run = new TestRun();
    run.startTimer();
    expect(run.start_time).toBeDefined();
    
    // Wait a bit
    setTimeout(() => {
      run.stopTimer();
      expect(run.duration).toBeGreaterThan(0);
    }, 10);
  });

  it('should add and get artifacts', () => {
    const run = new TestRun();
    const testData = Buffer.from('test data');
    run.addArtifact('test.txt', testData);
    
    const artifacts = run.getArtifacts();
    expect(artifacts['test.txt']).toEqual(testData);
  });

  it('should convert to dictionary', () => {
    const run = new TestRun({ source: 'test-source' });
    const dict = run.toDict();
    
    expect(dict.id).toBeDefined();
    expect(dict.source).toBe('test-source');
    expect(dict.summary).toBeDefined();
  });
});

describe('TestResult', () => {
  it('should create a test result', () => {
    const result = new TestResult({ test_id: 'test-1' });
    expect(result.id).toBeDefined();
    expect(isValidUUID(result.id)).toBe(true);
    expect(result.test_id).toBe('test-1');
    expect(result.result).toBe('passed');
  });

  it('should add and get artifacts', () => {
    const result = new TestResult({ test_id: 'test-1' });
    const screenshot = Buffer.from('fake screenshot');
    result.addArtifact('screenshot.png', screenshot);
    
    const artifacts = result.getArtifacts();
    expect(artifacts['screenshot.png']).toEqual(screenshot);
  });

  it('should convert to dictionary', () => {
    const result = new TestResult({ 
      test_id: 'test-1',
      result: 'failed'
    });
    const dict = result.toDict();
    
    expect(dict.id).toBeDefined();
    expect(dict.test_id).toBe('test-1');
    expect(dict.result).toBe('failed');
  });
});

describe('isValidUUID', () => {
  it('should validate correct UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('should reject invalid UUIDs', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
  });
});

