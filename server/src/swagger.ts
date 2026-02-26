/**
 * OpenAPI 3.0 specification for the Flipbook API.
 *
 * Served at /api/docs (Swagger UI) and /api/docs/spec.json (raw spec).
 */

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Flipbook API',
    version: '1.0.0',
    description:
      'Backend API for the Flipbook interactive e-book reader. Supports multi-book management, chapters, appearance customization, sounds, fonts, reading progress, and more.',
  },
  servers: [{ url: '/api', description: 'API root' }],
  tags: [
    { name: 'Auth', description: 'Authentication (email/password + Google OAuth)' },
    { name: 'Books', description: 'Book CRUD & reordering' },
    { name: 'Chapters', description: 'Chapter CRUD within a book' },
    { name: 'Appearance', description: 'Per-book appearance (cover colors, textures)' },
    { name: 'Sounds', description: 'Per-book page-flip sounds' },
    { name: 'Ambients', description: 'Per-book ambient background sounds' },
    { name: 'DecorativeFont', description: 'Per-book decorative (title) font' },
    { name: 'Progress', description: 'Per-book reading progress' },
    { name: 'DefaultSettings', description: 'Per-book default reader settings' },
    { name: 'Fonts', description: 'Global reading fonts' },
    { name: 'Settings', description: 'Global user settings' },
    { name: 'Upload', description: 'File uploads (fonts, sounds, images, books)' },
    { name: 'ExportImport', description: 'Full config export/import' },
    { name: 'Health', description: 'Server health checks' },
  ],
  components: {
    securitySchemes: {
      session: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
        description: 'Session cookie (set after login)',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          statusCode: { type: 'integer' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          displayName: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
        },
      },
      Book: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          author: { type: 'string', nullable: true },
          coverBgMode: { type: 'string', enum: ['default', 'none', 'custom'] },
          sortOrder: { type: 'integer' },
        },
      },
      Chapter: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          sortOrder: { type: 'integer' },
          bg: { type: 'string', nullable: true },
          bgMobile: { type: 'string', nullable: true },
        },
      },
      HealthCheck: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'] },
          timestamp: { type: 'string', format: 'date-time' },
          checks: {
            type: 'object',
            properties: {
              database: { type: 'string', enum: ['ok', 'error'] },
              storage: { type: 'string', enum: ['ok', 'error'] },
            },
          },
        },
      },
    },
  },
  security: [{ session: [] }],
  paths: {
    // ── Health ──────────────────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check with DB & S3 status',
        security: [],
        responses: {
          200: { description: 'All systems operational', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthCheck' } } } },
          503: { description: 'One or more subsystems degraded' },
        },
      },
    },
    // ── Auth ────────────────────────────────────────
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user (email + password)',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 }, displayName: { type: 'string' } } } } } },
        responses: { 201: { description: 'User created & logged in' }, 409: { description: 'Email already taken' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email + password',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } } } },
        responses: { 200: { description: 'Login successful' }, 401: { description: 'Invalid credentials' } },
      },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Logout (destroy session)', responses: { 200: { description: 'Logged out' } } },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Get current user', responses: { 200: { description: 'Authenticated user', content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } } }, 401: { description: 'Not authenticated' } } },
    },
    '/auth/google': {
      get: { tags: ['Auth'], summary: 'Redirect to Google OAuth', security: [], responses: { 302: { description: 'Redirect to Google' } } },
    },
    '/auth/google/callback': {
      get: { tags: ['Auth'], summary: 'Google OAuth callback', security: [], responses: { 302: { description: 'Redirect to app after auth' } } },
    },
    // ── Books ───────────────────────────────────────
    '/books': {
      get: { tags: ['Books'], summary: 'List user books', responses: { 200: { description: 'Array of books' } } },
      post: { tags: ['Books'], summary: 'Create a book', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title'], properties: { title: { type: 'string' }, author: { type: 'string' } } } } } }, responses: { 201: { description: 'Book created' } } },
    },
    '/books/reorder': {
      patch: { tags: ['Books'], summary: 'Reorder books', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['bookIds'], properties: { bookIds: { type: 'array', items: { type: 'string', format: 'uuid' } } } } } } }, responses: { 200: { description: 'Reordered' } } },
    },
    '/books/{bookId}': {
      get: { tags: ['Books'], summary: 'Get book by ID', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Book details' }, 404: { description: 'Not found' } } },
      patch: { tags: ['Books'], summary: 'Update book', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Books'], summary: 'Delete book', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
    },
    // ── Chapters ────────────────────────────────────
    '/books/{bookId}/chapters': {
      get: { tags: ['Chapters'], summary: 'List chapters', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Array of chapters' } } },
      post: { tags: ['Chapters'], summary: 'Create chapter', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'Chapter created' } } },
    },
    '/books/{bookId}/chapters/reorder': {
      patch: { tags: ['Chapters'], summary: 'Reorder chapters', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Reordered' } } },
    },
    '/books/{bookId}/chapters/{chapterId}': {
      get: { tags: ['Chapters'], summary: 'Get chapter', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'chapterId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Chapter details' } } },
      patch: { tags: ['Chapters'], summary: 'Update chapter', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'chapterId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Chapters'], summary: 'Delete chapter', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'chapterId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 204: { description: 'Deleted' } } },
    },
    '/books/{bookId}/chapters/{chapterId}/content': {
      get: { tags: ['Chapters'], summary: 'Get chapter HTML content', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'chapterId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Chapter HTML' } } },
    },
    // ── Appearance ──────────────────────────────────
    '/books/{bookId}/appearance': {
      get: { tags: ['Appearance'], summary: 'Get book appearance', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Appearance settings' } } },
      patch: { tags: ['Appearance'], summary: 'Update appearance (fontMin/fontMax)', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } },
    },
    '/books/{bookId}/appearance/{theme}': {
      patch: { tags: ['Appearance'], summary: 'Update theme appearance (light/dark)', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'theme', in: 'path', required: true, schema: { type: 'string', enum: ['light', 'dark'] } }], responses: { 200: { description: 'Theme updated' } } },
    },
    // ── Sounds ──────────────────────────────────────
    '/books/{bookId}/sounds': {
      get: { tags: ['Sounds'], summary: 'Get book sounds', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Sound config' } } },
      patch: { tags: ['Sounds'], summary: 'Update book sounds', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } },
    },
    // ── Ambients ────────────────────────────────────
    '/books/{bookId}/ambients': {
      get: { tags: ['Ambients'], summary: 'List ambients', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Array of ambients' } } },
      post: { tags: ['Ambients'], summary: 'Create ambient', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'Created' } } },
    },
    '/books/{bookId}/ambients/reorder': {
      patch: { tags: ['Ambients'], summary: 'Reorder ambients', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Reordered' } } },
    },
    '/books/{bookId}/ambients/{ambientId}': {
      patch: { tags: ['Ambients'], summary: 'Update ambient', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'ambientId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Ambients'], summary: 'Delete ambient', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'ambientId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 204: { description: 'Deleted' } } },
    },
    // ── Decorative Font ─────────────────────────────
    '/books/{bookId}/decorative-font': {
      get: { tags: ['DecorativeFont'], summary: 'Get decorative font', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Font data' }, 204: { description: 'No font set' } } },
      put: { tags: ['DecorativeFont'], summary: 'Upsert decorative font', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Font saved' } } },
      delete: { tags: ['DecorativeFont'], summary: 'Delete decorative font', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 204: { description: 'Deleted' } } },
    },
    // ── Progress ────────────────────────────────────
    '/books/{bookId}/progress': {
      get: { tags: ['Progress'], summary: 'Get reading progress', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Reading progress' } } },
      put: { tags: ['Progress'], summary: 'Save reading progress', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Progress saved' } } },
    },
    // ── Default Settings ────────────────────────────
    '/books/{bookId}/default-settings': {
      get: { tags: ['DefaultSettings'], summary: 'Get default reader settings', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Default settings' } } },
      patch: { tags: ['DefaultSettings'], summary: 'Update default reader settings', parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } },
    },
    // ── Fonts (global) ──────────────────────────────
    '/fonts': {
      get: { tags: ['Fonts'], summary: 'List reading fonts', responses: { 200: { description: 'Array of fonts' } } },
      post: { tags: ['Fonts'], summary: 'Create reading font', responses: { 201: { description: 'Font created' } } },
    },
    '/fonts/reorder': {
      patch: { tags: ['Fonts'], summary: 'Reorder fonts', responses: { 200: { description: 'Reordered' } } },
    },
    '/fonts/{fontId}': {
      patch: { tags: ['Fonts'], summary: 'Update font', parameters: [{ name: 'fontId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Fonts'], summary: 'Delete font', parameters: [{ name: 'fontId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 204: { description: 'Deleted' } } },
    },
    // ── Settings (global) ───────────────────────────
    '/settings': {
      get: { tags: ['Settings'], summary: 'Get global settings', responses: { 200: { description: 'Settings' } } },
      patch: { tags: ['Settings'], summary: 'Update global settings', responses: { 200: { description: 'Updated' } } },
    },
    // ── Upload ──────────────────────────────────────
    '/upload/font': {
      post: { tags: ['Upload'], summary: 'Upload a font file', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Uploaded URL' } } },
    },
    '/upload/sound': {
      post: { tags: ['Upload'], summary: 'Upload a sound file', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Uploaded URL' } } },
    },
    '/upload/image': {
      post: { tags: ['Upload'], summary: 'Upload an image', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Uploaded URL' } } },
    },
    '/upload/book': {
      post: { tags: ['Upload'], summary: 'Upload & parse a book file (txt/doc/docx/epub/fb2)', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Parsed book data' } } },
    },
    // ── Export / Import ─────────────────────────────
    '/export': {
      get: { tags: ['ExportImport'], summary: 'Export full user config as JSON', responses: { 200: { description: 'JSON config file' } } },
    },
    '/import': {
      post: { tags: ['ExportImport'], summary: 'Import user config from JSON', responses: { 200: { description: 'Import result' } } },
    },
  },
};

export const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Flipbook API — Swagger</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>SwaggerUIBundle({ url: '/api/docs/spec.json', dom_id: '#swagger-ui' });</script>
</body>
</html>`;
