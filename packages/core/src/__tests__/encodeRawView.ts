// Not in core's ES2020 lib, but present in Node and browsers.
declare const btoa: (s: string) => string

/** base64url of raw JSON, for views `encodeViewState` can't produce (e.g. wrongly typed fields). */
export const encodeRawView = (json: string) =>
  btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
