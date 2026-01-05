/**
 * PII detection and redaction
 *
 * Detects and redacts personally identifiable information from text.
 * Supports emails, phones, credit cards, SSNs, API keys, and more.
 *
 * @module pii
 */

export interface PIIMatch {
  type: string;
  value: string;
  start: number;
  end: number;
}

export interface RedactionResult {
  text: string;
  matches: PIIMatch[];
  redacted: boolean;
}

// PII detection patterns
const PII_PATTERNS: Array<{ type: string; pattern: RegExp; replacement: string }> = [
  // Email addresses
  {
    type: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL]',
  },
  // Phone numbers (international)
  {
    type: 'phone',
    pattern: /\+?[0-9]{1,4}[-.\s]?\(?[0-9]{1,3}\)?[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}/g,
    replacement: '[PHONE]',
  },
  // Credit card numbers
  {
    type: 'credit_card',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CREDIT_CARD]',
  },
  // Social Security Numbers (US)
  {
    type: 'ssn',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: '[SSN]',
  },
  // JWT tokens
  {
    type: 'jwt',
    pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    replacement: '[JWT]',
  },
  // API keys (common patterns)
  {
    type: 'api_key',
    pattern: /\b(sk|pk|api|key|token|secret|password)[_-]?[a-zA-Z0-9]{20,}\b/gi,
    replacement: '[API_KEY]',
  },
  // AWS keys
  {
    type: 'aws_key',
    pattern: /\b(AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: '[AWS_KEY]',
  },
  // Private keys
  {
    type: 'private_key',
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
    replacement: '[PRIVATE_KEY]',
  },
  // IP addresses (v4)
  {
    type: 'ip_address',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[IP_ADDRESS]',
  },
  // Passwords in common formats
  {
    type: 'password',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']?[^\s"']+["']?/gi,
    replacement: '[PASSWORD]',
  },
];

/**
 * Detect PII patterns in text.
 *
 * @param text - Text to scan for PII
 * @returns Array of matches with type, value, and position
 *
 * @example
 * ```ts
 * const matches = detectPII("Contact: john@example.com");
 * // [{ type: "email", value: "john@example.com", start: 9, end: 25 }]
 * ```
 */
export function detectPII(text: string): PIIMatch[] {
  const matches: PIIMatch[] = [];

  for (const { type, pattern } of PII_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      matches.push({
        type,
        value: match[0],
        start: match.index!,
        end: match.index! + match[0].length,
      });
    }
  }

  // Sort by position
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * Check if text contains any PII.
 *
 * @param text - Text to check
 * @returns True if PII detected
 */
export function containsPII(text: string): boolean {
  return detectPII(text).length > 0;
}

/**
 * Redact PII from text with placeholders.
 *
 * Replaces detected PII with type-specific placeholders like [EMAIL], [PHONE].
 *
 * @param text - Text to redact
 * @returns Result with redacted text, matches, and redaction flag
 *
 * @example
 * ```ts
 * const result = redactPII("Email: test@example.com");
 * // { text: "Email: [EMAIL]", matches: [...], redacted: true }
 * ```
 */
export function redactPII(text: string): RedactionResult {
  const matches = detectPII(text);

  if (matches.length === 0) {
    return { text, matches: [], redacted: false };
  }

  let redactedText = text;
  let offset = 0;

  // Process matches in order, adjusting for length changes
  for (const match of matches) {
    const replacement = PII_PATTERNS.find((p) => p.type === match.type)?.replacement ?? '[REDACTED]';
    const adjustedStart = match.start + offset;
    const adjustedEnd = match.end + offset;

    redactedText = redactedText.substring(0, adjustedStart) + replacement + redactedText.substring(adjustedEnd);

    offset += replacement.length - (match.end - match.start);
  }

  return {
    text: redactedText,
    matches,
    redacted: true,
  };
}

/**
 * Get PII detection statistics.
 *
 * @param text - Text to analyze
 * @returns Object with counts per PII type
 */
export function getPIIStats(text: string): Record<string, number> {
  const matches = detectPII(text);
  const stats: Record<string, number> = {};

  for (const match of matches) {
    stats[match.type] = (stats[match.type] ?? 0) + 1;
  }

  return stats;
}

/**
 * Check if file path indicates sensitive content.
 *
 * Detects .env, credentials, keys, and similar patterns.
 *
 * @param path - File path to check
 * @returns True if path suggests sensitive content
 */
export function isSensitivePath(path: string): boolean {
  const sensitivePatterns = [
    /\.env$/i,
    /\.env\.[^/]+$/i,
    /credentials/i,
    /secrets?/i,
    /private/i,
    /\.pem$/i,
    /\.key$/i,
    /id_rsa/i,
    /id_ed25519/i,
    /\.keystore$/i,
    /\.jks$/i,
  ];

  return sensitivePatterns.some((pattern) => pattern.test(path));
}
