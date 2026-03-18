import { main } from '@axhxrx/op';
import { WelcomeOp } from './GameOps.ts';

export { main };

if (import.meta.main)
{
  const initialOp = new WelcomeOp();
  await main(initialOp);
}
