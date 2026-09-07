declare module 'ua-parser-js' {
  export class UAParser {
    constructor(ua?: string);
    getResult(): {
      device: { type?: string };
      os: { name?: string };
      browser: { name?: string; version?: string };
    };
  }
}
