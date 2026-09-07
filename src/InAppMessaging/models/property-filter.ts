import { iamLog } from '../log';

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'contains'
  | 'between';

export interface PropertyFilter {
  property: string;
  operator: FilterOperator;
  value: unknown;
}

/** The sync carries the dashboard's enum names verbatim (Is, Greater, Between…); long spellings and symbols are accepted too. */
export function parseOperator(raw: unknown): FilterOperator | null {
  if (typeof raw !== 'string') return null;
  switch (raw.toLowerCase().replace(/_/g, '')) {
    case 'is':
    case 'equals':
    case 'equal':
    case 'eq':
    case '==':
      return 'equals';
    case 'isnot':
    case 'notequals':
    case 'notequal':
    case 'ne':
    case '!=':
      return 'not_equals';
    case 'greater':
    case 'greaterthan':
    case 'gt':
    case '>':
      return 'greater_than';
    case 'greaterorequal':
    case 'greaterthanorequal':
    case 'greaterthanorequals':
    case 'gte':
    case '>=':
      return 'greater_than_or_equal';
    case 'less':
    case 'lessthan':
    case 'lt':
    case '<':
      return 'less_than';
    case 'lessorequal':
    case 'lessthanorequal':
    case 'lessthanorequals':
    case 'lte':
    case '<=':
      return 'less_than_or_equal';
    case 'between':
      return 'between';
    case 'contains':
      return 'contains';
    default:
      return null;
  }
}

function asNum(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const na = asNum(a);
  const nb = asNum(b);
  if (na !== null && nb !== null) return na === nb;
  return String(a) === String(b);
}

function bounds(value: unknown): [number, number] | null {
  const parts: unknown[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
    ? value.split(',')
    : [];
  if (parts.length !== 2) return null;
  const low = asNum(typeof parts[0] === 'string' ? parts[0].trim() : parts[0]);
  const high = asNum(typeof parts[1] === 'string' ? parts[1].trim() : parts[1]);
  if (low === null || high === null) return null;
  return low <= high ? [low, high] : [high, low];
}

/** A missing property never matches: a filter is a requirement. */
export function filterMatches(
  filter: PropertyFilter,
  properties: Record<string, unknown>
): boolean {
  const actual = properties[filter.property];
  if (actual === undefined || actual === null) return false;

  switch (filter.operator) {
    case 'equals':
      return looseEquals(actual, filter.value);
    case 'not_equals':
      return !looseEquals(actual, filter.value);
    case 'contains':
      return String(actual)
        .toLowerCase()
        .includes(String(filter.value).toLowerCase());
    case 'between': {
      const a = asNum(actual);
      const range = bounds(filter.value);
      if (a === null || range === null) {
        iamLog(
          `filter "${filter.property}" between skipped: "${String(
            actual
          )}" and "${String(
            filter.value
          )}" do not give a number and a numeric range`
        );
        return false;
      }
      return a >= range[0] && a <= range[1];
    }
    default: {
      const a = asNum(actual);
      const b = asNum(filter.value);
      if (a === null || b === null) {
        iamLog(
          `filter "${filter.property}" ${filter.operator} skipped: "${String(
            actual
          )}" and "${String(filter.value)}" are not both numeric`
        );
        return false;
      }
      if (filter.operator === 'greater_than') return a > b;
      if (filter.operator === 'greater_than_or_equal') return a >= b;
      if (filter.operator === 'less_than') return a < b;
      return a <= b;
    }
  }
}

/** Every filter must pass. An empty list matches anything. */
export function allFiltersMatch(
  filters: PropertyFilter[],
  properties: Record<string, unknown>
): boolean {
  for (const filter of filters) {
    if (!filterMatches(filter, properties)) return false;
  }
  return true;
}
