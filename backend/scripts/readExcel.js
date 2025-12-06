const XLSX = require('xlsx');

// Read the I&E file
const iePath = '/Users/nikolashulewsky/Desktop/Deal Files/Odd Fellows Year to Date I & E Mar2025-Sept2025.xls';
const ieWorkbook = XLSX.readFile(iePath);
console.log('=== I&E File Sheets:', ieWorkbook.SheetNames);

// Get first sheet data
const ieSheet = ieWorkbook.Sheets[ieWorkbook.SheetNames[0]];
const ieData = XLSX.utils.sheet_to_json(ieSheet, { header: 1, defval: '' });

// Print first 80 rows to see structure
console.log('\n=== I&E Data (first 80 rows):');
ieData.slice(0, 80).forEach((row, i) => {
  const filtered = row.filter(cell => cell !== '');
  if (filtered.length > 0) {
    console.log(i + ':', filtered.slice(0, 5).join(' | '));
  }
});

// Look for labor/salary keywords
console.log('\n=== Rows containing labor/salary/wage/food keywords:');
ieData.forEach((row, i) => {
  const rowStr = row.join(' ').toLowerCase();
  if (rowStr.includes('labor') || rowStr.includes('salary') || rowStr.includes('wage') ||
      rowStr.includes('food') || rowStr.includes('dietary') || rowStr.includes('culinary') ||
      rowStr.includes('utilities') || rowStr.includes('management')) {
    const filtered = row.filter(cell => cell !== '');
    console.log(i + ':', filtered.slice(0, 5).join(' | '));
  }
});
