import { MemoryStore } from '../../storage/key-value-store';

describe('MemoryStore', () => {
  it('round-trips and removes', () => {
    const s = new MemoryStore();
    expect(s.get('a')).toBeNull();
    s.set('a', '1');
    expect(s.get('a')).toBe('1');
    s.set('a', '2');
    expect(s.get('a')).toBe('2');
    s.remove('a');
    expect(s.get('a')).toBeNull();
  });

  it('keeps keys apart', () => {
    const s = new MemoryStore();
    s.set('a', '1');
    s.set('b', '2');
    expect([s.get('a'), s.get('b')]).toEqual(['1', '2']);
    s.remove('a');
    expect([s.get('a'), s.get('b')]).toEqual([null, '2']);
  });
});
