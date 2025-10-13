import { describe, expect, test } from 'bun:test';
import { FetchOp } from './FetchOp';

describe('FetchOp', () =>
{
  test('basic GET request with JSON parsing', async () =>
  {
    const op = FetchOp.getJson('https://httpbin.org/json');
    const result = await op.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      expect(result.value.status).toBe(200);
      expect(result.value.data).toBeDefined();
      expect(typeof result.value.data).toBe('object');
    }
  });

  test('POST request with JSON body', async () =>
  {
    const testData = { message: 'test', timestamp: Date.now() };
    const op = FetchOp.postJson('https://httpbin.org/post', testData);
    const result = await op.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      expect(result.value.status).toBe(200);
      const responseData = result.value.data as { json: typeof testData };
      expect(responseData.json).toEqual(testData);
    }
  });

  test('custom headers are sent', async () =>
  {
    const op = FetchOp.getJson('https://httpbin.org/headers', {
      headers: {
        'X-Custom-Header': 'test-value',
        'User-Agent': 'FetchOp-Test',
      },
    });
    const result = await op.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      const responseData = result.value.data as { headers: Record<string, string> };
      expect(responseData.headers['X-Custom-Header']).toBe('test-value');
      expect(responseData.headers['User-Agent']).toBe('FetchOp-Test');
    }
  });

  test('query parameters are appended correctly', async () =>
  {
    const op = FetchOp.getJson('https://httpbin.org/get', {
      queryParams: {
        foo: 'bar',
        test: 'value',
      },
    });
    const result = await op.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      const responseData = result.value.data as { args: Record<string, string> };
      expect(responseData.args.foo).toBe('bar');
      expect(responseData.args.test).toBe('value');
    }
  });

  test('timeout fails with timeout error', async () =>
  {
    const op = new FetchOp('https://httpbin.org/delay/5', {
      timeout: 1000, // 1 second timeout, but endpoint delays 5 seconds
    });
    const result = await op.run();

    expect(result.ok).toBe(false);
    if (!result.ok)
    {
      expect(result.failure).toBe('timeout');
      expect(result.debugData).toContain('1000ms');
    }
  });

  test('HTTP errors are detected (404)', async () =>
  {
    const op = FetchOp.get('https://httpbin.org/status/404');
    const result = await op.run();

    expect(result.ok).toBe(false);
    if (!result.ok)
    {
      expect(result.failure).toBe('httpError');
      expect(result.debugData).toContain('404');
    }
  });

  test('HTTP errors are detected (500)', async () =>
  {
    const op = FetchOp.get('https://httpbin.org/status/500');
    const result = await op.run();

    expect(result.ok).toBe(false);
    if (!result.ok)
    {
      expect(result.failure).toBe('httpError');
      expect(result.debugData).toContain('500');
    }
  });

  test('custom status validation allows 404', async () =>
  {
    const op = FetchOp.get('https://httpbin.org/status/404', {
      validateStatus: (status) => status < 500, // Treat anything < 500 as success
    });
    const result = await op.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      expect(result.value.status).toBe(404);
    }
  });

  test('parse error when expecting JSON but getting HTML', async () =>
  {
    const op = new FetchOp('https://example.com', {
      parseAs: 'json',
    });
    const result = await op.run();

    expect(result.ok).toBe(false);
    if (!result.ok)
    {
      expect(result.failure).toBe('parseError');
    }
  });

  test('text parsing works', async () =>
  {
    const op = new FetchOp('https://httpbin.org/html', {
      parseAs: 'text',
    });
    const result = await op.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      expect(typeof result.value.data).toBe('string');
      expect((result.value.data as string).includes('<!DOCTYPE html>')).toBe(true);
    }
  });

  test('invalid URL fails with invalidUrl', async () =>
  {
    const op = new FetchOp('not-a-valid-url');
    const result = await op.run();

    expect(result.ok).toBe(false);
    if (!result.ok)
    {
      expect(result.failure).toBe('invalidUrl');
    }
  });

  test('response headers are returned', async () =>
  {
    const op = FetchOp.getJson('https://httpbin.org/get');
    const result = await op.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      expect(result.value.headers).toBeDefined();
      expect(typeof result.value.headers).toBe('object');
      expect(result.value.headers['content-type']).toContain('application/json');
    }
  });

  test('DELETE request works', async () =>
  {
    const op = FetchOp.delete('https://httpbin.org/delete');
    const result = await op.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      expect(result.value.status).toBe(200);
    }
  });

  test('PUT request works', async () =>
  {
    const op = FetchOp.put('https://httpbin.org/put', JSON.stringify({ test: 'data' }), {
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await op.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      expect(result.value.status).toBe(200);
    }
  });

  test('GitHub API real-world example', async () =>
  {
    const op = FetchOp.getJson('https://api.github.com/users/octocat');
    const result = await op.run();

    expect(result.ok).toBe(true);
    if (result.ok)
    {
      const data = result.value.data as { login: string; name: string };
      expect(data.login).toBe('octocat');
      expect(data.name).toBeDefined();
    }
  });
});
