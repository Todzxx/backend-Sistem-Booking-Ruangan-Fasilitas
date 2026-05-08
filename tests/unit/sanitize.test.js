const sanitizeMiddleware = require('../../src/middleware/sanitize.middleware');

describe('Sanitize Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: null, query: null, params: null };
    res = {};
    next = jest.fn();
  });

  it('should encode HTML special characters in body', () => {
    req.body = { name: '<script>alert("xss")</script>', description: 'Hello & welcome' };

    sanitizeMiddleware(req, res, next);

    expect(req.body.name).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(req.body.description).toBe('Hello &amp; welcome');
    expect(next).toHaveBeenCalled();
  });

  it('should handle nested objects', () => {
    req.body = { user: { name: '<img src=x onerror=alert(1)>' } };

    sanitizeMiddleware(req, res, next);

    expect(req.body.user.name).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(next).toHaveBeenCalled();
  });

  it('should handle arrays', () => {
    req.body = { tags: ['<a>', '<b>'] };

    sanitizeMiddleware(req, res, next);

    expect(req.body.tags[0]).toBe('&lt;a&gt;');
    expect(req.body.tags[1]).toBe('&lt;b&gt;');
    expect(next).toHaveBeenCalled();
  });

  it('should pass through non-string values', () => {
    req.body = { count: 5, active: true, data: null };

    sanitizeMiddleware(req, res, next);

    expect(req.body.count).toBe(5);
    expect(req.body.active).toBe(true);
    expect(req.body.data).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('should handle missing body, query, params', () => {
    sanitizeMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
