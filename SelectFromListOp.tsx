import { render } from 'ink';
import SelectInput from 'ink-select-input';
import type { IOContext } from './IOContext';
import { Op } from './Op';

/**
 Prompt user to select from a list of strings. Returns the selected string on success.

 If you pass an `as const` array for `options`, you can exhaustively check the returned value (it will be typed as one of your input strings).
 */
export class SelectFromListOp<OptionsT extends string[]> extends Op
{
  name = 'SelectFromListOp';

  constructor(private options: OptionsT)
  {
    super();
  }

  async run(io?: IOContext)
  {
    type SuccessT = typeof this.options[number];
    const ioContext = this.getIO(io);
    const { stdin, stdout } = ioContext;

    const chosen = await new Promise<SuccessT>((resolve) =>
    {
      const items = this.options.map(option => ({ label: option, value: option }));

      const { unmount } = render(
        <SelectInput
          items={items}
          onSelect={(item) =>
          {
            unmount(); // Stop rendering and return control
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            resolve(item.value as SuccessT);
          }}
        />,
        // @ts-expect-error - Ink expects WriteStream but we use WritableStream for logging
        { stdin, stdout },
      );
    });

    return this.succeed(chosen);
  }
}
