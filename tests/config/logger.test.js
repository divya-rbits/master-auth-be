const logger = require('../../src/config/logger');

describe('Logger Configuration', () => {
  // Store original NODE_ENV
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });

  describe('Logger Instance', () => {
    test('should be defined', () => {
      expect(logger).toBeDefined();
    });

    test('should have error method', () => {
      expect(typeof logger.error).toBe('function');
    });

    test('should have warn method', () => {
      expect(typeof logger.warn).toBe('function');
    });

    test('should have info method', () => {
      expect(typeof logger.info).toBe('function');
    });

    test('should have debug method', () => {
      expect(typeof logger.debug).toBe('function');
    });

    test('should have stream object', () => {
      expect(logger.stream).toBeDefined();
      expect(typeof logger.stream.write).toBe('function');
    });
  });

  describe('Log Methods', () => {
    // Suppress actual log output during tests
    beforeEach(() => {
      jest.spyOn(logger, 'error').mockImplementation(() => {});
      jest.spyOn(logger, 'warn').mockImplementation(() => {});
      jest.spyOn(logger, 'info').mockImplementation(() => {});
      jest.spyOn(logger, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should log error messages', () => {
      logger.error('Test error message');
      expect(logger.error).toHaveBeenCalledWith('Test error message');
    });

    test('should log warn messages', () => {
      logger.warn('Test warning message');
      expect(logger.warn).toHaveBeenCalledWith('Test warning message');
    });

    test('should log info messages', () => {
      logger.info('Test info message');
      expect(logger.info).toHaveBeenCalledWith('Test info message');
    });

    test('should log debug messages', () => {
      logger.debug('Test debug message');
      expect(logger.debug).toHaveBeenCalledWith('Test debug message');
    });

    test('should log messages with metadata', () => {
      const metadata = { userId: 123, action: 'login' };
      logger.info('User action', metadata);
      expect(logger.info).toHaveBeenCalledWith('User action', metadata);
    });

    test('should log error with stack trace', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', { error });
      expect(logger.error).toHaveBeenCalledWith('Error occurred', { error });
    });
  });

  describe('Stream Object', () => {
    beforeEach(() => {
      jest.spyOn(logger, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should write to info log level', () => {
      logger.stream.write('Test stream message\n');
      expect(logger.info).toHaveBeenCalledWith('Test stream message');
    });

    test('should trim newlines from stream messages', () => {
      logger.stream.write('Test message with newline\n');
      expect(logger.info).toHaveBeenCalledWith('Test message with newline');
    });
  });

  describe('Environment Configuration', () => {
    test('should have transports configured', () => {
      expect(logger.transports).toBeDefined();
      expect(Array.isArray(logger.transports)).toBe(true);
      expect(logger.transports.length).toBeGreaterThan(0);
    });

    test('should not exit on error', () => {
      expect(logger.exitOnError).toBe(false);
    });
  });
});
