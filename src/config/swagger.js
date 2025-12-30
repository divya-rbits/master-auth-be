const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Master Password Authentication API',
      version: '1.0.0',
      description: 'API documentation for Master Password Authentication Backend',
      contact: {
        name: 'API Support',
        url: 'https://github.com/divya-rbits/master-auth-be'
      }
    },
    servers: [
      {
        url: 'http://localhost:11557',
        description: 'Development server'
      },
      {
        url: 'http://localhost:{port}',
        description: 'Custom port server',
        variables: {
          port: {
            default: '11557'
          }
        }
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Admin JWT token authentication. Login via /api/admin/auth/login to get token.'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              oneOf: [
                {
                  type: 'string',
                  description: 'Simple error message'
                },
                {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      description: 'Error message'
                    },
                    statusCode: {
                      type: 'integer',
                      description: 'HTTP status code'
                    }
                  }
                }
              ]
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        }
      }
    }
  },
  apis: ['./src/index.js', './src/routes/**/*.js', './src/controllers/**/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
