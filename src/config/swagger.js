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
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'http://localhost:{port}',
        description: 'Custom port server',
        variables: {
          port: {
            default: '3001'
          }
        }
      }
    ],
    components: {
      securitySchemes: {
        BasicAuth: {
          type: 'http',
          scheme: 'basic',
          description: 'Admin authentication using HTTP Basic Auth'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Error message'
                },
                status: {
                  type: 'integer',
                  description: 'HTTP status code'
                }
              }
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
