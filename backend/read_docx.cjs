const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function extractDocx(filePath) {
  try {
    const zip = new AdmZip(filePath);
    const textXml = zip.readAsText('word/document.xml');
    // Extract text from w:t tags
    const paragraphs = textXml.split('</w:p>');
    const lines = [];
    for (const p of paragraphs) {
      const matches = p.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (matches) {
        const lineText = matches.map(m => m.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '')).join('');
        if (lineText.trim()) lines.push(lineText.trim());
      }
    }
    return lines.join('\n');
  } catch (err) {
    return 'Error extracting ' + filePath + ': ' + err.message;
  }
}

const file1 = 'C:/Users/mihir/Downloads/5 MIN CANDLE 1ST PART (1).docx';
const file2 = 'C:/Users/mihir/Downloads/5 MIN CANDLE 2nd part.docx';

console.log('================== 5 MIN CANDLE 1ST PART ==================');
console.log(extractDocx(file1));
console.log('\n\n================== 5 MIN CANDLE 2ND PART ==================');
console.log(extractDocx(file2));
