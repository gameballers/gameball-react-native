/**
 * React Native's blob and FileReader, as far as the SDK uses them.
 *
 * A React Native blob holds its bytes in native memory until it is closed, and its FileReader hands
 * back a data uri of those bytes, typed by the blob, on a later tick. Node has neither, so the
 * `iam` project installs these around the tests that download artwork.
 */
export interface StubBlob {
  type: string;
  size: number;
  /** The blob's bytes, already base64 — what the data uri carries. */
  bytes: string;
  close: jest.Mock;
}

export function stubBlob(bytes: string, type = 'image/png'): StubBlob {
  return { type, size: bytes.length, bytes, close: jest.fn() };
}

/** Installs the FileReader and returns its removal. */
export function installFileReader(): () => void {
  const scope = globalThis as { FileReader?: unknown };
  const real = scope.FileReader;
  scope.FileReader = class {
    result: string | null = null;
    error: Error | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL(blob: StubBlob) {
      Promise.resolve().then(() => {
        this.result = `data:${blob.type};base64,${blob.bytes}`;
        this.onload?.();
      });
    }
  };
  return () => {
    scope.FileReader = real;
  };
}
