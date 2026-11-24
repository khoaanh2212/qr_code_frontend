/** A short link's code: 8 characters from 0-9, A-Z, a-z (the API's rule). */
const SHORT_CODE = /^[0-9A-Za-z]{8}$/;

/**
 * The short code in what a visitor pasted: the whole short link (with or without the scheme,
 * a trailing slash, query or fragment) or just the code. Null when there is none.
 */
export function parseShortCode(input: string): string | null {
  let v = input.trim();
  if (v === "") return null;
  v = v.replace(/[?#].*$/, "").replace(/\/+$/, "");
  const code = v.slice(v.lastIndexOf("/") + 1);
  return SHORT_CODE.test(code) ? code : null;
}
