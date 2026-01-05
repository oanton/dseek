/**
 * Markdown parser unit tests
 *
 * Consolidated tests for markdown extraction functions.
 */

import { describe, expect, it } from 'vitest';
import { extractHeadings, extractSections, isCodeBlockDelimiter } from '../../src/parsers/markdown.js';

describe('Markdown Parser', () => {
  describe('extractHeadings', () => {
    it('extracts all heading levels', () => {
      const content = `# H1
## H2
### H3
some text
#### H4
##### H5
###### H6`;

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(6);
      expect(headings[0]).toEqual({ level: 1, text: 'H1', line: 1 });
      expect(headings[1]).toEqual({ level: 2, text: 'H2', line: 2 });
      expect(headings[5]).toEqual({ level: 6, text: 'H6', line: 7 });
    });

    it('returns empty array for no headings', () => {
      const content = 'Just some text\nwithout any headings';
      expect(extractHeadings(content)).toHaveLength(0);
    });

    it('handles headings with special characters', () => {
      const content = '# API `GET /users` endpoint';
      const headings = extractHeadings(content);

      expect(headings[0].text).toBe('API `GET /users` endpoint');
    });
  });

  describe('extractSections', () => {
    it('splits content by headings', () => {
      const content = `# Section 1
Content for section 1

## Section 2
Content for section 2`;

      const sections = extractSections(content);

      expect(sections).toHaveLength(2);
      expect(sections[0].heading).toBe('Section 1');
      expect(sections[0].level).toBe(1);
      expect(sections[1].heading).toBe('Section 2');
      expect(sections[1].level).toBe(2);
    });

    it('handles content before first heading', () => {
      const content = `Some intro text

# First Section
Section content`;

      const sections = extractSections(content);

      expect(sections).toHaveLength(2);
      expect(sections[0].heading).toBeNull();
      expect(sections[0].level).toBe(0);
      expect(sections[1].heading).toBe('First Section');
    });

    it('ignores headers inside code blocks', () => {
      const content = `# Real Heading

\`\`\`markdown
# This is NOT a heading
## Neither is this
\`\`\`

## Another Real Heading`;

      const sections = extractSections(content);

      expect(sections).toHaveLength(2);
      expect(sections.map((s) => s.heading)).toEqual(['Real Heading', 'Another Real Heading']);
    });

    it('handles content without any headings', () => {
      const content = 'Just plain text\nwith multiple lines\nbut no headings';
      const sections = extractSections(content);

      expect(sections).toHaveLength(1);
      expect(sections[0].heading).toBeNull();
      expect(sections[0].content).toBe(content);
    });

    it('tracks correct line numbers', () => {
      const content = `# First
line 2
line 3
## Second
line 5`;

      const sections = extractSections(content);

      expect(sections[0].startLine).toBe(1);
      expect(sections[0].endLine).toBe(3);
      expect(sections[1].startLine).toBe(4);
      expect(sections[1].endLine).toBe(5);
    });
  });

  describe('isCodeBlockDelimiter', () => {
    it('detects valid code block delimiters', () => {
      // Triple backticks
      expect(isCodeBlockDelimiter('```')).toBe(true);
      // With language identifier
      expect(isCodeBlockDelimiter('```typescript')).toBe(true);
      expect(isCodeBlockDelimiter('```javascript')).toBe(true);
      expect(isCodeBlockDelimiter('```python')).toBe(true);
      // With leading whitespace
      expect(isCodeBlockDelimiter('  ```')).toBe(true);
      expect(isCodeBlockDelimiter('\t```js')).toBe(true);
    });

    it('returns false for regular text', () => {
      expect(isCodeBlockDelimiter('regular text')).toBe(false);
      expect(isCodeBlockDelimiter('``not enough`')).toBe(false);
      expect(isCodeBlockDelimiter('# heading')).toBe(false);
    });
  });
});
