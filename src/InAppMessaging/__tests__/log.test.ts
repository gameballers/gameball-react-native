import { iamLog, setLogEnabled, isLogEnabled } from '../log';

describe('iamLog', () => {
  const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
  afterEach(() => {
    spy.mockClear();
    setLogEnabled(true);
  });

  it('prefixes every line with [GameballIAM]', () => {
    iamLog('hello');
    expect(spy).toHaveBeenCalledWith('[GameballIAM] hello');
  });

  it('keeps the switch on the global, so a duplicated copy of this module obeys it too', () => {
    setLogEnabled(false);
    // What a second bundled copy of log.ts would read (the CJS subpath build makes one).
    expect(
      (globalThis as { __gameballIamLogEnabled?: boolean })
        .__gameballIamLogEnabled
    ).toBe(false);
    setLogEnabled(true);
    expect(isLogEnabled()).toBe(true);
  });

  it('is silent when disabled', () => {
    setLogEnabled(false);
    iamLog('quiet');
    expect(spy).not.toHaveBeenCalled();
    expect(isLogEnabled()).toBe(false);
  });
});
