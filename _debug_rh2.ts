import { readFileSync } from 'fs';
import { parseCsvText, detectFormat } from './src/lib/csv-parser';

const csv = readFileSync('.local/csv/8aae038f-86f7-5a36-8ada-158ddb7a7e24.csv', 'utf-8');
const { headers, rows } = parseCsvText(csv);
console.log('Total records:', rows.length);
console.log('Headers:', headers.join(' | '));
rows.forEach((r, i) => {
  const amt = r['Amount']?.trim();
  const tc = r['Trans Code']?.trim();
  const inst = r['Instrument']?.trim();
  if (!amt && !tc && !inst) {
    console.log('Row', i, 'EMPTY/DISCLAIMER');
  } else if (!amt || amt === '') {
    console.log('Row', i, 'NO AMOUNT:', tc, inst, r['Description']?.split('\n')[0]?.slice(0, 40));
  }
});
