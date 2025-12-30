/**
 * Environment Variable Validation Utility
 * Validates all required environment variables on application startup
 * Prevents server from starting with invalid or missing configuration
 */

const logger = require('./logger');

/**
 * Validation error class
 */
class EnvironmentValidationError extends Error {
  constructor(errors) {
    const message = `Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    super(message);
    this.name = 'EnvironmentValidationError';
    this.errors = errors;
  }
}

/**
 * Validation rules for each environment variable
 */
const validationRules = {
  // Server Configuration
  PORT: {
    required: false,
    type: 'number',
    min: 1,
    max: 65535,
    default: 11557,
    description: 'Server port number'
  },

  NODE_ENV: {
    required: false,
    type: 'string',
    enum: ['development', 'staging', 'production', 'test'],
    default: 'development',
    description: 'Application environment mode'
  },

  // Database Configuration
  SUPABASE_URL: {
    required: true,
    type: 'url',
    pattern: /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/,
    description: 'Supabase project URL'
  },

  SUPABASE_SERVICE_KEY: {
    required: true,
    type: 'string',
    minLength: 50,
    description: 'Supabase service role key',
    sensitive: true
  },

  // Authentication & Security
  JWT_SECRET: {
    required: true,
    type: 'string',
    minLength: 32,
    description: 'JWT signing secret',
    sensitive: true,
    securityNote: 'Should be cryptographically secure random string'
  },

  TOKEN_EXPIRATION: {
    required: false,
    type: 'number',
    min: 60,
    max: 31536000, // 1 year
    default: 3600,
    description: 'Token expiration time in seconds'
  },

  // CORS Configuration
  ALLOWED_ORIGINS: {
    required: true,
    type: 'string',
    custom: (value) => {
      const origins = value.split(',').map(o => o.trim()).filter(o => o);
      if (origins.length === 0) {
        return 'Must contain at least one origin';
      }
      for (const origin of origins) {
        try {
          new URL(origin);
        } catch {
          return `Invalid URL format: ${origin}`;
        }
      }
      return null;
    },
    description: 'Comma-separated list of allowed CORS origins'
  },

  // Admin Panel
  ADMIN_USERNAME: {
    required: true,
    type: 'string',
    minLength: 4,
    maxLength: 50,
    description: 'Admin panel username',
    securityNote: 'Should not be "admin" or other common usernames'
  },

  ADMIN_PASSWORD: {
    required: true,
    type: 'string',
    minLength: 16,
    description: 'Admin panel password',
    sensitive: true,
    securityNote: 'Should be a strong, unique password'
  }
};

/**
 * Validate a single environment variable
 * @param {string} name - Variable name
 * @param {*} value - Variable value
 * @param {object} rules - Validation rules
 * @returns {string|null} Error message or null if valid
 */
function validateVariable(name, value, rules) {
  // Check if required
  if (rules.required && !value) {
    return `${name}: Required variable is missing`;
  }

  // If not required and not provided, use default
  if (!value && !rules.required) {
    if (rules.default !== undefined) {
      process.env[name] = String(rules.default);
    }
    return null;
  }

  // Type validation
  if (rules.type === 'number') {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return `${name}: Must be a valid number`;
    }

    if (rules.min !== undefined && num < rules.min) {
      return `${name}: Must be at least ${rules.min} (current: ${num})`;
    }

    if (rules.max !== undefined && num > rules.max) {
      return `${name}: Must be at most ${rules.max} (current: ${num})`;
    }
  }

  if (rules.type === 'string') {
    if (typeof value !== 'string') {
      return `${name}: Must be a string`;
    }

    if (rules.minLength && value.length < rules.minLength) {
      return `${name}: Must be at least ${rules.minLength} characters (current: ${value.length})`;
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return `${name}: Must be at most ${rules.maxLength} characters (current: ${value.length})`;
    }

    if (rules.enum && !rules.enum.includes(value)) {
      return `${name}: Must be one of: ${rules.enum.join(', ')} (current: ${value})`;
    }
  }

  if (rules.type === 'url') {
    try {
      new URL(value);
    } catch {
      return `${name}: Must be a valid URL`;
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      return `${name}: Does not match expected format`;
    }
  }

  // Custom validation
  if (rules.custom) {
    const error = rules.custom(value);
    if (error) {
      return `${name}: ${error}`;
    }
  }

  return null;
}

/**
 * Validate all environment variables
 * @param {object} options - Validation options
 * @param {boolean} options.throwOnError - Throw error if validation fails (default: true)
 * @param {boolean} options.logWarnings - Log security warnings (default: true)
 * @returns {object} Validation result
 */
function validateEnvironment(options = {}) {
  const { throwOnError = true, logWarnings = true } = options;

  const errors = [];
  const warnings = [];

  // Validate each variable
  for (const [name, rules] of Object.entries(validationRules)) {
    const value = process.env[name];
    const error = validateVariable(name, value, rules);

    if (error) {
      errors.push(error);
    } else if (value && rules.securityNote && logWarnings) {
      // Add security warnings for weak configurations
      if (name === 'ADMIN_USERNAME' && ['admin', 'administrator', 'root'].includes(value.toLowerCase())) {
        warnings.push(`${name}: Using common username "${value}" is not recommended for security`);
      }

      if (name === 'JWT_SECRET' && value.length < 64) {
        warnings.push(`${name}: Consider using a longer secret (current: ${value.length} chars, recommended: 64+)`);
      }
    }
  }

  // Check for production-specific requirements
  if (process.env.NODE_ENV === 'production') {
    // Warn about HTTP origins in production
    const origins = process.env.ALLOWED_ORIGINS || '';
    if (origins.includes('http://') && !origins.includes('localhost')) {
      warnings.push('ALLOWED_ORIGINS: Using HTTP origins in production is not secure. Use HTTPS instead.');
    }

    // Warn about default/weak credentials
    if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 24) {
      warnings.push('ADMIN_PASSWORD: Production password should be at least 24 characters for better security');
    }
  }

  // Log results
  if (errors.length > 0) {
    logger.error('❌ Environment validation failed:');
    errors.forEach(error => logger.error(`  ${error}`));
    logger.error('\nServer cannot start until all environment variables are valid.');
    logger.error('Please check your .env file and refer to docs/ENVIRONMENT_VARIABLES.md\n');

    if (throwOnError) {
      throw new EnvironmentValidationError(errors);
    }
  } else {
    logger.info('✅ Environment validation passed');
  }

  if (warnings.length > 0 && logWarnings) {
    logger.warn('⚠️  Environment configuration warnings:');
    warnings.forEach(warning => logger.warn(`  ${warning}`));
    logger.warn('');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get environment variable with validation
 * @param {string} name - Variable name
 * @param {*} defaultValue - Default value if not set
 * @returns {*} Variable value
 */
function getEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined) {
    if (defaultValue === undefined && validationRules[name]?.required) {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    return defaultValue;
  }

  // Convert to appropriate type
  const rules = validationRules[name];
  if (rules?.type === 'number') {
    return parseInt(value, 10);
  }

  return value;
}

/**
 * Print environment configuration summary (without sensitive values)
 */
function printEnvironmentSummary() {
  logger.info('Environment Configuration:');
  logger.info(`  NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`  PORT: ${process.env.PORT || 11557}`);
  logger.info(`  TOKEN_EXPIRATION: ${process.env.TOKEN_EXPIRATION || 3600}s`);
  logger.info(`  SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ Set' : '✗ Not set'}`);
  logger.info(`  SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? '✓ Set (hidden)' : '✗ Not set'}`);
  logger.info(`  JWT_SECRET: ${process.env.JWT_SECRET ? '✓ Set (hidden)' : '✗ Not set'}`);
  logger.info(`  ADMIN_USERNAME: ${process.env.ADMIN_USERNAME || '✗ Not set'}`);
  logger.info(`  ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? '✓ Set (hidden)' : '✗ Not set'}`);

  const origins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(o => o) || [];
  logger.info(`  ALLOWED_ORIGINS: ${origins.length} origin(s) configured`);
  if (origins.length > 0 && origins.length <= 5) {
    origins.forEach(origin => logger.info(`    - ${origin}`));
  }
  logger.info('');
}

module.exports = {
  validateEnvironment,
  validateVariable,
  getEnv,
  printEnvironmentSummary,
  validationRules,
  EnvironmentValidationError
};
