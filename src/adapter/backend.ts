/**
 * The transport behind the adapter (ADR-0002). A Backend carries one function
 * per existing Apps Script server function and returns the legacy
 * {success, ...} envelopes. Production uses the google.script.run delegate;
 * development uses the behavior-faithful mock.
 */
export type Backend = Record<string, (...args: unknown[]) => unknown>;
