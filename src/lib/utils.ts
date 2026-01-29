/**
 * Utility Functions
 */

type ClassValue = string | boolean | undefined | null | ClassValue[];

/**
 * Concatenate class names, filtering out falsy values
 * Simple replacement for clsx/classnames libraries
 *
 * @example
 * cn('foo', 'bar') // 'foo bar'
 * cn('foo', condition && 'bar') // 'foo bar' or 'foo'
 * cn('foo', ['bar', 'baz']) // 'foo bar baz'
 */
export function cn(...classes: ClassValue[]): string {
  return classes
    .flat()
    .filter((c): c is string => typeof c === 'string' && c.length > 0)
    .join(' ');
}
