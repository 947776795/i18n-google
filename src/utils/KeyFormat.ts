export interface FormattedKeyParts {
  modulePath: string;
  key: string;
}

/**
 * Utilities for formatting and parsing combined translation keys in the form of:
 * [modulePath][key]
 */
export const KeyFormat = {
  format(modulePath: string, key: string): string {
    return `[${modulePath}][${key}]`;
  },

  parse(formatted: string): FormattedKeyParts | null {
    const match = formatted.match(/^\[(.+)\]\[([^\]]+)\]$/);
    if (!match) return null;
    return { modulePath: match[1], key: match[2] };
  },
};
