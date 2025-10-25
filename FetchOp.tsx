#!/usr/bin/env bun

import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';

/**
 Options for FetchOp
 */
export interface FetchOpOptions
{
  /**
   HTTP method. Default: 'GET'
   */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

  /**
   HTTP headers to send with the request
   */
  headers?: Record<string, string>;

  /**
   Request body. Can be a string, FormData, or URLSearchParams
   */
  body?: string | FormData | URLSearchParams;

  /**
   Query parameters to append to the URL. Will be URL-encoded and appended as ?key=value&key2=value2
   */
  queryParams?: Record<string, string>;

  /**
   Request timeout in milliseconds. Default: 30000 (30 seconds)
   */
  timeout?: number;

  /**
   How to parse the response body. Default: 'json'

   - 'json': Parse as JSON
   - 'text': Parse as text
   - 'blob': Parse as Blob
   - 'arrayBuffer': Parse as ArrayBuffer
   - 'none': Don't parse, return the Response object
   */
  parseAs?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'none';

  /**
   Function to determine if a status code should be treated as success. Default: status < 400

   @param status - The HTTP status code
   @returns true if the status should be treated as success, false otherwise
   */
  validateStatus?: (status: number) => boolean;

  /**
   Whether to follow redirects. Default: true
   */
  followRedirects?: boolean;
}

/**
 Success value returned by FetchOp
 */
export interface FetchOpSuccess<T = unknown>
{
  /**
   HTTP status code
   */
  status: number;

  /**
   HTTP status text (e.g., 'OK', 'Not Found')
   */
  statusText: string;

  /**
   Response headers as a plain object
   */
  headers: Record<string, string>;

  /**
   Parsed response data (type depends on parseAs option)
   */
  data: T;

  /**
   Final URL after any redirects
   */
  url: string;
}

/**
 FetchOp - Make HTTP requests that fit into the Ops Pattern

 Every HTTP request becomes an Op with proper success/failure handling, making API clients and scrapers composable and testable.

 Success value: FetchOpSuccess with { status, statusText, headers, data, url }

 Failure: 'networkError' | 'httpError' | 'parseError' | 'timeout' | 'invalidUrl' | 'aborted'

 @example
 ```typescript
 // Simple GET request
 const op = new FetchOp('https://api.github.com/users/octocat');
 const result = await op.run();

 if (result.ok) {
   console.log('User data:', result.value.data);
 } else if (result.failure === 'httpError') {
   console.log('HTTP error:', result.debugData);
 }

 // POST with JSON
 const op = FetchOp.postJson('https://httpbin.org/post', {
   hello: 'world'
 });

 // Custom headers and query params
 const op = new FetchOp('https://api.example.com/search', {
   queryParams: { q: 'ops pattern' },
   headers: { 'Authorization': 'Bearer token123' }
 });
 ```
 */
export class FetchOp<T = unknown> extends Op
{
  name = 'FetchOp';
  private options: Required<Omit<FetchOpOptions, 'body'>> & { body?: string | FormData | URLSearchParams };

  constructor(
    private url: string,
    options?: FetchOpOptions,
  )
  {
    super();
    this.options = {
      method: options?.method ?? 'GET',
      headers: options?.headers ?? {},
      body: options?.body,
      queryParams: options?.queryParams ?? {},
      timeout: options?.timeout ?? 30000,
      parseAs: options?.parseAs ?? 'json',
      validateStatus: options?.validateStatus ?? ((status: number) => status < 400),
      followRedirects: options?.followRedirects ?? true,
    };
  }

  async run(_io?: IOContext)
  {
    try
    {
      // Build URL with query parameters
      let finalUrl: URL;
      try
      {
        finalUrl = new URL(this.url);
      }
      catch (_error)
      {
        return this.fail('invalidUrl' as const, `Invalid URL: ${this.url}`);
      }

      // Append query parameters
      Object.entries(this.options.queryParams).forEach(([key, value]) =>
      {
        finalUrl.searchParams.append(key, value);
      });

      // Setup timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      try
      {
        // Make the fetch request
        const response = await fetch(finalUrl.toString(), {
          method: this.options.method,
          headers: this.options.headers,
          body: this.options.body ?? undefined,
          signal: controller.signal,
          redirect: this.options.followRedirects ? 'follow' : 'manual',
        });

        clearTimeout(timeoutId);

        // Check if status is valid
        if (!this.options.validateStatus(response.status))
        {
          return this.fail(
            'httpError' as const,
            `HTTP ${response.status} ${response.statusText}`,
          );
        }

        // Parse response headers
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) =>
        {
          headers[key] = value;
        });

        // Parse response body
        let data: T;
        try
        {
          switch (this.options.parseAs)
          {
            case 'json':
              data = (await response.json()) as T;
              break;
            case 'text':
              data = (await response.text()) as T;
              break;
            case 'blob':
              data = (await response.blob()) as T;
              break;
            case 'arrayBuffer':
              data = (await response.arrayBuffer()) as T;
              break;
            case 'none':
              data = response as T;
              break;
            default:
            {
              const _exhaustive: never = this.options.parseAs;
              return this.failWithUnknownError(`Unknown parseAs: ${String(_exhaustive)}`);
            }
          }
        }
        catch (error)
        {
          return this.fail('parseError' as const, String(error));
        }

        return this.succeed({
          status: response.status,
          statusText: response.statusText,
          headers,
          data,
          url: response.url,
        });
      }
      catch (error: unknown)
      {
        clearTimeout(timeoutId);

        // Check if it was aborted (timeout)
        if (error && typeof error === 'object' && 'name' in error)
        {
          if (error.name === 'AbortError')
          {
            return this.fail('timeout' as const, `Request timed out after ${this.options.timeout}ms`);
          }
        }

        // Network error (couldn't reach server)
        return this.fail('networkError' as const, String(error));
      }
    }
    catch (error)
    {
      return this.failWithUnknownError(String(error));
    }
  }

  /**
   Static helper: Make a GET request
   */
  static get<T = unknown>(url: string, options?: Omit<FetchOpOptions, 'method'>): FetchOp<T>
  {
    return new FetchOp<T>(url, { ...options, method: 'GET' });
  }

  /**
   Static helper: Make a POST request
   */
  static post<T = unknown>(
    url: string,
    body: string | FormData | URLSearchParams,
    options?: Omit<FetchOpOptions, 'method' | 'body'>,
  ): FetchOp<T>
  {
    return new FetchOp<T>(url, { ...options, method: 'POST', body });
  }

  /**
   Static helper: Make a PUT request
   */
  static put<T = unknown>(
    url: string,
    body: string | FormData | URLSearchParams,
    options?: Omit<FetchOpOptions, 'method' | 'body'>,
  ): FetchOp<T>
  {
    return new FetchOp<T>(url, { ...options, method: 'PUT', body });
  }

  /**
   Static helper: Make a DELETE request
   */
  static delete<T = unknown>(url: string, options?: Omit<FetchOpOptions, 'method'>): FetchOp<T>
  {
    return new FetchOp<T>(url, { ...options, method: 'DELETE' });
  }

  /**
   Static helper: Make a GET request and parse as JSON
   */
  static getJson<T = unknown>(url: string, options?: Omit<FetchOpOptions, 'method' | 'parseAs'>): FetchOp<T>
  {
    return new FetchOp<T>(url, { ...options, method: 'GET', parseAs: 'json' });
  }

  /**
   Static helper: Make a POST request with JSON body
   */
  static postJson<T = unknown>(
    url: string,
    data: unknown,
    options?: Omit<FetchOpOptions, 'method' | 'body' | 'parseAs'>,
  ): FetchOp<T>
  {
    return new FetchOp<T>(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      parseAs: 'json',
    });
  }
}

if (import.meta.main)
{
  const args = process.argv.slice(2);

  if (args.length > 0)
  {
    // Fetch the URL provided and show preview
    const url = args[0]!;
    console.log(`🌐 Fetching: ${url}\n`);

    // Fetch as text first
    const op = new FetchOp(url, { parseAs: 'text' });
    const result = await op.run();

    if (result.ok)
    {
      console.log(`✅ Status: ${result.value.status} ${result.value.statusText}`);
      console.log(`📍 URL: ${result.value.url}\n`);

      const content = result.value.data as string;

      // Try to parse as JSON first
      let isJson = false;
      let jsonData: unknown;
      try
      {
        jsonData = JSON.parse(content);
        isJson = true;
      }
      catch
      {
        // Not JSON, that's fine
      }

      if (isJson)
      {
        // Show JSON with syntax highlighting via FilePreviewOp
        console.log('📄 Content-Type: JSON\n');
        const fs = await import('node:fs');
        const os = await import('node:os');
        const path = await import('node:path');

        const tempFile = path.join(os.tmpdir(), `fetch-${Date.now()}.json`);
        fs.writeFileSync(tempFile, JSON.stringify(jsonData, null, 2));

        const { FilePreviewOp } = await import('./FilePreviewOp');
        const previewOp = new FilePreviewOp(tempFile);
        const previewResult = await previewOp.run();

        fs.unlinkSync(tempFile);

        if (previewResult.ok && previewResult.value && 'run' in previewResult.value)
        {
          await (previewResult.value as Op).run();
        }
      }
      else if (content.trim().match(/^<!DOCTYPE|^<html/i))
      {
        // HTML - convert to markdown and render!
        console.log('📄 Content-Type: HTML (converting to markdown for preview)\n');
        try
        {
          const { NodeHtmlMarkdown } = await import('node-html-markdown');
          const markdown = NodeHtmlMarkdown.translate(content);

          const { RenderMarkdownOp } = await import('./RenderMarkdownOp');
          const markdownOp = new RenderMarkdownOp(markdown);
          await markdownOp.run();
        }
        catch (_htmlError)
        {
          console.log('⚠️  Could not convert HTML to markdown, showing raw HTML\n');
          console.log(content.substring(0, 2000));
          if (content.length > 2000)
          {
            console.log(`\n... (${content.length - 2000} more characters)`);
          }
        }
      }
      else
      {
        // Plain text
        console.log('📄 Content-Type: Text\n');
        console.log(content);
      }
    }
    else
    {
      console.log(`\n❌ Error: ${result.failure}`);
      if (result.debugData)
      {
        console.log(`   Details: ${result.debugData}`);
      }
      process.exit(1);
    }
  }
  else
  {
    // Run demos
    console.log('🎬 FetchOp Demo\n');

    // Demo 1: GitHub API
    console.log('📝 Demo 1: Fetching GitHub user data (GET request with JSON)');
    const githubOp = FetchOp.getJson('https://api.github.com/users/octocat');
    const githubResult = await githubOp.run();

    if (githubResult.ok)
    {
      const data = githubResult.value.data as { login: string; name: string; public_repos: number };
      console.log(`✅ User: ${data.login} (${data.name})`);
      console.log(`   Public repos: ${data.public_repos}`);
    }
    else
    {
      console.log(`❌ Failed: ${githubResult.failure}`);
    }

    console.log('');

    // Demo 2: POST with JSON
    console.log('📝 Demo 2: POST request with JSON body');
    const postOp = FetchOp.postJson('https://httpbin.org/post', {
      message: 'Hello from FetchOp!',
      timestamp: new Date().toISOString(),
    });
    const postResult = await postOp.run();

    if (postResult.ok)
    {
      const data = postResult.value.data as { json: { message: string } };
      console.log(`✅ Posted data:`, data.json);
      console.log(postResult.value.status, postResult.value.statusText);
    }
    else
    {
      console.log(`❌ Failed: ${postResult.failure}`);
    }

    console.log('');

    // Demo 3: Query parameters
    console.log('📝 Demo 3: GET request with query parameters');
    const queryOp = FetchOp.getJson('https://httpbin.org/get', {
      queryParams: { foo: 'bar', test: 'ops-pattern' },
    });
    const queryResult = await queryOp.run();

    if (queryResult.ok)
    {
      const data = queryResult.value.data as { args: Record<string, string> };
      console.log(`✅ Query params received:`, data.args);
    }
    else
    {
      console.log(`❌ Failed: ${queryResult.failure}`);
    }

    console.log('');

    // Demo 4: Custom headers
    console.log('📝 Demo 4: GET request with custom headers');
    const headersOp = FetchOp.getJson('https://httpbin.org/headers', {
      headers: {
        'X-Custom-Header': 'FetchOp-Demo',
        'User-Agent': 'OpsPattern/1.0',
      },
    });
    const headersResult = await headersOp.run();

    if (headersResult.ok)
    {
      const data = headersResult.value.data as { headers: Record<string, string> };
      console.log(`✅ Custom header sent:`, data.headers['X-Custom-Header']);
    }
    else
    {
      console.log(`❌ Failed: ${headersResult.failure}`);
    }

    console.log('');

    // Demo 5: Error handling (404)
    console.log('📝 Demo 5: Error handling (404 Not Found)');
    const errorOp = FetchOp.get('https://httpbin.org/status/404');
    const errorResult = await errorOp.run();

    if (!errorResult.ok && errorResult.failure === 'httpError')
    {
      console.log(`✅ HTTP error caught correctly: ${errorResult.debugData}`);
    }
    else
    {
      console.log(`❌ Unexpected result`);
    }

    console.log('');
    console.log('🎉 All demos complete!');
    console.log('\nTip: You can also fetch a specific URL:');
    console.log('  bun FetchOp.tsx <url>');
  }
}
