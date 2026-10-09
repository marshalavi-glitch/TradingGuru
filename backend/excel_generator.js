import zlib from 'zlib';
import fs from 'fs';
import path from 'path';

// CRC32 table for pure Node zip generation
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function createZipBuffer(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const contentBuf = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
    const uncompressedSize = contentBuf.length;
    const crc = crc32(contentBuf);
    const compressedBuf = zlib.deflateRawSync(contentBuf);
    const compressedSize = compressedBuf.length;

    // Local Header
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // signature
    lh.writeUInt16LE(20, 4);         // version
    lh.writeUInt16LE(0, 6);          // flag
    lh.writeUInt16LE(8, 8);          // deflate
    lh.writeUInt16LE(0, 10);         // time
    lh.writeUInt16LE(0, 12);         // date
    lh.writeUInt32LE(crc, 14);       // crc32
    lh.writeUInt32LE(compressedSize, 18);
    lh.writeUInt32LE(uncompressedSize, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    nameBuf.copy(lh, 30);

    localHeaders.push(lh, compressedBuf);

    // Central Directory Header
    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compressedSize, 20);
    cd.writeUInt32LE(uncompressedSize, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    nameBuf.copy(cd, 46);

    centralHeaders.push(cd);
    offset += lh.length + compressedBuf.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((acc, h) => acc + h.length, 0);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colToLetter(colIndex) {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function buildWorksheetXml(rows, colWidths = []) {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n`;

  if (colWidths.length > 0) {
    xml += `  <cols>\n`;
    colWidths.forEach((w, idx) => {
      xml += `    <col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>\n`;
    });
    xml += `  </cols>\n`;
  }

  xml += `  <sheetData>\n`;

  rows.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 1;
    xml += `    <row r="${rowNum}">\n`;
    row.forEach((cell, colIdx) => {
      const cellRef = `${colToLetter(colIdx)}${rowNum}`;
      if (cell === null || cell === undefined || cell === '') {
        // empty cell
      } else if (typeof cell === 'number') {
        xml += `      <c r="${cellRef}"><v>${cell}</v></c>\n`;
      } else {
        xml += `      <c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>\n`;
      }
    });
    xml += `    </row>\n`;
  });

  xml += `  </sheetData>\n</worksheet>`;
  return xml;
}

/**
 * Builds standard OpenXML (.xlsx) buffer from multi-sheet definition
 * @param {Array<{ name: string, rows: Array<Array<any>>, colWidths?: Array<number> }>} sheets 
 * @returns {Buffer} XLSX zip binary
 */
export function buildExcelWorkbook(sheets) {
  const files = [];

  // 1. [Content_Types].xml
  let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n  <Default Extension="xml" ContentType="application/xml"/>\n  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\n`;
  sheets.forEach((s, idx) => {
    contentTypes += `  <Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\n`;
  });
  contentTypes += `  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>\n</Types>`;
  files.push({ name: '[Content_Types].xml', content: contentTypes });

  // 2. _rels/.rels
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\n</Relationships>`;
  files.push({ name: '_rels/.rels', content: rootRels });

  // 3. xl/_rels/workbook.xml.rels
  let wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n`;
  sheets.forEach((s, idx) => {
    wbRels += `  <Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>\n`;
  });
  wbRels += `  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\n</Relationships>`;
  files.push({ name: 'xl/_rels/workbook.xml.rels', content: wbRels });

  // 4. xl/workbook.xml
  let wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n  <sheets>\n`;
  sheets.forEach((s, idx) => {
    wb += `    <sheet name="${escapeXml(s.name)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>\n`;
  });
  wb += `  </sheets>\n</workbook>`;
  files.push({ name: 'xl/workbook.xml', content: wb });

  // 5. xl/styles.xml
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>\n  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>\n  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>\n  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellXfs>\n</styleSheet>`;
  files.push({ name: 'xl/styles.xml', content: styles });

  // 6. Each sheet
  sheets.forEach((s, idx) => {
    const sheetXml = buildWorksheetXml(s.rows, s.colWidths || []);
    files.push({ name: `xl/worksheets/sheet${idx + 1}.xml`, content: sheetXml });
  });

  return createZipBuffer(files);
}

/**
 * Builds CSV string with UTF-8 BOM
 * @param {Array<Array<any>>} rows 
 * @returns {string} CSV content
 */
export function buildCsv(rows) {
  const escapeCsvVal = (v) => {
    if (v === null || v === undefined) return '';
    const str = String(v);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = rows.map(r => r.map(escapeCsvVal).join(','));
  return '\uFEFF' + lines.join('\r\n');
}
