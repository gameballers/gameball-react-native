import {
  messageHasTokens,
  tokensIn,
  substituteTokens,
  substituteInto,
  clearUnresolvedTokens,
} from '../../personalisation/tokens';
import { message } from '../helpers/fixtures';

const btn = (text: string) => ({
  id: 'b',
  text,
  action: { type: 'dismiss' as const },
  style: {},
});

describe('tokens', () => {
  it('detects strict {identifier} tokens only', () => {
    expect(messageHasTokens(message({ header: 'Hi {first_name}' }))).toBe(true);
    expect(
      messageHasTokens(
        message({ header: 'Hi', body: 'x', buttons: [btn('{cta}')] })
      )
    ).toBe(true);
    expect(
      messageHasTokens(message({ header: '{ spaced }', body: '{2}' }))
    ).toBe(false);
    expect(messageHasTokens(message({ header: null, body: null }))).toBe(false);
  });
  it('lists distinct token names', () => {
    expect(
      tokensIn(
        message({ header: '{a} {b}', body: '{a}', buttons: [btn('{c}')] })
      )
    ).toEqual(new Set(['a', 'b', 'c']));
  });
  it('substitutes known tokens once and leaves unknown ones', () => {
    expect(
      substituteTokens('Hi {name}, {points} pts {unknown}', {
        name: 'Ana',
        points: '{name}',
      })
    ).toBe('Hi Ana, {name} pts {unknown}');
    expect(substituteTokens('plain', {})).toBe('plain');
  });
  it('substituteInto rewrites header, body and buttons keeping ids', () => {
    const m = substituteInto(
      message({ header: '{a}', body: '{b}', buttons: [btn('{c}')] }),
      { a: 'A', b: 'B', c: 'C' }
    );
    expect(m.header).toBe('A');
    expect(m.body).toBe('B');
    expect(m.buttons[0]).toMatchObject({ id: 'b', text: 'C' });
  });
  it('clearUnresolvedTokens blanks what is left', () => {
    const m = clearUnresolvedTokens(
      message({ header: 'Hi {name}!', body: 'ok', buttons: [btn('Go {x}')] })
    );
    expect(m.header).toBe('Hi !');
    expect(m.body).toBe('ok');
    expect(m.buttons[0]!.text).toBe('Go ');
  });
});
