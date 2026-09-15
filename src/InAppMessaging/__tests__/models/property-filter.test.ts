import {
  filterMatches,
  allFiltersMatch,
  parseOperator,
  type PropertyFilter,
} from '../../models/property-filter';

const f = (
  operator: PropertyFilter['operator'],
  value: unknown,
  property = 'price'
): PropertyFilter => ({ property, operator, value });

describe('filterMatches', () => {
  it('a missing property never matches', () => {
    expect(filterMatches(f('equals', 1), {})).toBe(false);
  });
  it('equals compares loosely across number and string', () => {
    expect(filterMatches(f('equals', '2', 'quantity'), { quantity: 2 })).toBe(
      true
    );
    expect(
      filterMatches(f('equals', 'shoes', 'category'), { category: 'shoes' })
    ).toBe(true);
    expect(
      filterMatches(f('equals', 'shoes', 'category'), { category: 'Shoes' })
    ).toBe(false);
  });
  it('not_equals is the negation', () => {
    expect(
      filterMatches(f('not_equals', 'shoes', 'category'), { category: 'bags' })
    ).toBe(true);
    expect(
      filterMatches(f('not_equals', 2, 'quantity'), { quantity: '2' })
    ).toBe(false);
  });
  it('contains is case-insensitive', () => {
    expect(
      filterMatches(f('contains', 'SHOE', 'category'), {
        category: 'running shoes',
      })
    ).toBe(true);
    expect(
      filterMatches(f('contains', 'bag', 'category'), { category: 'shoes' })
    ).toBe(false);
  });
  it('numeric comparisons refuse non-numbers', () => {
    expect(filterMatches(f('greater_than', 100), { price: 120 })).toBe(true);
    expect(filterMatches(f('greater_than', 100), { price: '120' })).toBe(true);
    expect(filterMatches(f('greater_than', 100), { price: 'expensive' })).toBe(
      false
    );
    expect(filterMatches(f('greater_than_or_equal', 100), { price: 100 })).toBe(
      true
    );
    expect(filterMatches(f('less_than', 100), { price: 99.5 })).toBe(true);
    expect(filterMatches(f('less_than_or_equal', 100), { price: 100 })).toBe(
      true
    );
    expect(filterMatches(f('less_than_or_equal', 100), { price: 101 })).toBe(
      false
    );
  });
  it('between is inclusive, accepts "min,max" with spaces, a list, and swapped bounds', () => {
    expect(filterMatches(f('between', '10,20'), { price: 10 })).toBe(true);
    expect(filterMatches(f('between', '10, 20'), { price: 20 })).toBe(true);
    expect(filterMatches(f('between', [10, 20]), { price: 15 })).toBe(true);
    expect(filterMatches(f('between', '20,10'), { price: 15 })).toBe(true);
    expect(filterMatches(f('between', '10,20'), { price: 21 })).toBe(false);
    expect(filterMatches(f('between', '10'), { price: 10 })).toBe(false);
    expect(filterMatches(f('between', '10,20'), { price: 'x' })).toBe(false);
  });
});

describe('allFiltersMatch', () => {
  it('an empty list matches anything', () => {
    expect(allFiltersMatch([], {})).toBe(true);
  });
  it('every filter must pass (AND)', () => {
    const filters = [f('greater_than', 100), f('equals', 'shoes', 'category')];
    expect(allFiltersMatch(filters, { price: 120, category: 'shoes' })).toBe(
      true
    );
    expect(allFiltersMatch(filters, { price: 120, category: 'bags' })).toBe(
      false
    );
  });
});

describe('parseOperator', () => {
  it('accepts the dashboard enum names', () => {
    expect(parseOperator('Is')).toBe('equals');
    expect(parseOperator('IsNot')).toBe('not_equals');
    expect(parseOperator('Greater')).toBe('greater_than');
    expect(parseOperator('GreaterOrEqual')).toBe('greater_than_or_equal');
    expect(parseOperator('Less')).toBe('less_than');
    expect(parseOperator('LessOrEqual')).toBe('less_than_or_equal');
    expect(parseOperator('Between')).toBe('between');
    expect(parseOperator('Contains')).toBe('contains');
    expect(parseOperator('Equals')).toBe('equals');
  });
  it('accepts long spellings and symbols', () => {
    expect(parseOperator('greater_than')).toBe('greater_than');
    expect(parseOperator('>=')).toBe('greater_than_or_equal');
    expect(parseOperator('!=')).toBe('not_equals');
  });
  it('rejects unknown operators and non-strings', () => {
    expect(parseOperator('Regex')).toBeNull();
    expect(parseOperator(3)).toBeNull();
    expect(parseOperator(undefined)).toBeNull();
  });
});
