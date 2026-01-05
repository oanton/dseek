/**
 * Script to create test fixtures for PDF and DOCX parsers
 * Run: npx tsx scripts/create-test-fixtures.ts
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const TESTDATA_DIR = join(process.cwd(), 'testdata');

// Ensure testdata directory exists
if (!existsSync(TESTDATA_DIR)) {
  mkdirSync(TESTDATA_DIR, { recursive: true });
}

/**
 * Create a minimal valid PDF file
 * PDF structure is text-based, we can create it manually
 */
function createSamplePdf() {
  // Minimal PDF 1.4 with "Test Document" text
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test Document) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000359 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
434
%%EOF`;

  writeFileSync(join(TESTDATA_DIR, 'sample.pdf'), pdf);
  console.log('Created: testdata/sample.pdf');
}

/**
 * Create a minimal valid DOCX file
 * DOCX is a ZIP archive with XML files
 */
function createSampleDocx() {
  // Use pandoc if available, otherwise create minimal structure
  try {
    // Create a simple markdown and convert to docx
    const mdContent = '# Test Document\n\nThis is a test paragraph for DOCX parsing.';
    const mdPath = join(TESTDATA_DIR, '_temp.md');
    const docxPath = join(TESTDATA_DIR, 'sample.docx');

    writeFileSync(mdPath, mdContent);

    try {
      execSync(`pandoc ${mdPath} -o ${docxPath}`, { stdio: 'pipe' });
      console.log('Created: testdata/sample.docx (via pandoc)');
    } catch {
      // Pandoc not available, create minimal DOCX manually using archiver approach
      console.log('Pandoc not available, creating minimal DOCX manually...');
      createMinimalDocx();
    }

    // Clean up temp file
    try {
      execSync(`rm ${mdPath}`, { stdio: 'pipe' });
    } catch {
      // Ignore
    }
  } catch (error) {
    console.error('Error creating DOCX:', error);
    createMinimalDocx();
  }
}

/**
 * Create minimal DOCX without external tools
 */
function createMinimalDocx() {
  // DOCX is a ZIP file with specific XML structure
  // We'll use the built-in zlib and create the structure manually
  const JSZip = require('jszip');
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  // _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  // word/document.xml
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Test Document</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This is a test paragraph for DOCX parsing.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`,
  );

  // word/_rels/document.xml.rels
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`,
  );

  zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true }).pipe(
    require('fs').createWriteStream(join(TESTDATA_DIR, 'sample.docx')),
  );

  console.log('Created: testdata/sample.docx (minimal)');
}

// Run
console.log('Creating test fixtures...\n');
createSamplePdf();
createSampleDocx();
console.log('\nDone!');
