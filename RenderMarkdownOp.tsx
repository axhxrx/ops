import { render } from 'ink';
import { marked } from 'marked';
// @ts-expect-error - marked-terminal has runtime named export but no TS declarations
import { markedTerminal } from 'marked-terminal';
import type { IOContext } from './IOContext';
import { Op } from './Op';
import { MarkdownRenderer } from './RenderMarkdownOp.ui';

// Configure marked to use terminal renderer (once, at module level)
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
marked.use(markedTerminal({ emoji: true, width: 80, reflowText: true, unescape: true }) as any);

/**
 RenderMarkdownOp - Display markdown content beautifully in the terminal

 Success value: void (just displays content)
 Failure: none (always succeeds)

 Features:
 - Renders markdown with syntax highlighting
 - Supports headings, lists, code blocks, bold, italic
 - Press any key to dismiss

 @example
 ```typescript
 const content = `
 # Welcome to My App

 This is a **bold** statement with *italic* text.

 ## Features
 - Feature 1
 - Feature 2

 \`\`\`typescript
 const greeting = 'Hello, world!';
 console.log(greeting);
 \`\`\`
 `;

 const op = new RenderMarkdownOp(content);
 await op.run();
 ```
 */
export class RenderMarkdownOp extends Op
{
  name = 'RenderMarkdownOp';

  constructor(private content: string, private waitForKeyPress: boolean = true)
  {
    super();
  }

  async run(io?: IOContext)
  {
    await Promise.resolve();
    const ioContext = this.getIO(io);

    // If we don't need to wait for keypress, just print the markdown directly
    if (!this.waitForKeyPress)
    {
      const formattedOutput = marked(this.content) as string;
      console.log(formattedOutput);
      return this.succeed(undefined);
    }

    // Interactive mode: render with React/Ink and wait for keypress
    let done = false;

    const { unmount, waitUntilExit } = render(
      <MarkdownRenderer
        content={this.content}
        logger={ioContext.logger}
        onDone={() =>
        {
          this.log(io, 'Markdown dismissed');
          done = true;
          unmount();
        }}
      />,
      {
        stdin: ioContext.stdin as NodeJS.ReadStream,
        stdout: ioContext.stdout as NodeJS.WriteStream,
      },
    );

    await waitUntilExit();

    if (!done)
    {
      return this.failWithUnknownError('Markdown display did not complete');
    }

    return this.succeed(undefined);
  }
}

if (import.meta.main)
{
  const sampleMarkdown = `
# 🎉 Welcome to RenderMarkdownOp!

This component displays **beautiful markdown** in your terminal using \`marked\` + \`marked-terminal\`.

## Features

- ass [hol](https://example.com)
- wop _nerd_ **HAULYI**

## Example Table

| Feature       | Status | Priority |
|---------------|--------|----------|
| Headings      | ✅     | High     |
| Lists         | ✅     | High     |
| Tables        | ✅     | Medium   |
| Code blocks   | ✅     | High     |
| Inline code   | ✅     | Medium   |

## Code Example

\`\`\`typescript
const op = new RenderMarkdownOp(content);
const result = await op.run();

if (result.ok) {
  console.log('Markdown displayed successfully!');
}
\`\`\`

## Why is this awesome?

Because *inline markdown* in CLI apps makes them **so much better**!

---

**This is powered by marked-terminal - no CommonJS hell!** 🎊
`;

  const op = new RenderMarkdownOp(sampleMarkdown);
  const outcome = await op.run();

  if (outcome.ok)
  {
    console.log('\n✅ Markdown displayed successfully!');
  }
  else
  {
    console.log('\n❌ Error:', outcome.debugData);
  }
}
