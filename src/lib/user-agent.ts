/**
 * "Chrome" + "macOS" from a user agent string, for the device list. Deliberately small: only
 * the browsers and systems people recognize; anything else shows its product token.
 */
export interface DeviceName {
  browser: string;
  os: string | null;
}

const BROWSERS: [RegExp, string][] = [
  [/Edg(A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Version\/[\d.]+.*Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPad/, "iPadOS"],
  [/iPhone|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

export function describeUserAgent(ua: string): DeviceName | null {
  const value = ua.trim();
  if (!value) return null;
  const browser = BROWSERS.find(([re]) => re.test(value))?.[1];
  const os = SYSTEMS.find(([re]) => re.test(value))?.[1] ?? null;
  if (browser) return { browser, os };
  // Not a browser (an API client, a script): its first product token, e.g. "curl".
  const product = /^([A-Za-z][\w.-]{0,30})\//.exec(value)?.[1];
  return product ? { browser: product, os } : null;
}
