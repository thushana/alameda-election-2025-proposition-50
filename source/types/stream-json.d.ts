declare module 'stream-json' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any;
  export default mod;
}

declare module 'stream-json/filters/Pick' {
  import type { ReadWriteStream } from 'node:stream';
  export function pick(args: { filter: string }): ReadWriteStream;
}

declare module 'stream-json/streamers/StreamArray' {
  import type { ReadWriteStream } from 'node:stream';
  export function streamArray(...args: unknown[]): ReadWriteStream;
}

declare module 'stream-json/filters/Pick.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any;
  export default mod;
}

declare module 'stream-json/streamers/StreamArray.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any;
  export default mod;
}
