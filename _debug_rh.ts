import { readFileSync } from 'fs';
import { parseCsv } from './src/lib/csv-parser';

for (const f of ['19091403-813c-5f9c-96fe-aa9aeecc6d2d.csv', '8aae038f-86f7-5a36-8ada-158ddb7a7e24.csv']) {
  const csv = readFileSync('.local/csv/' + f, 'utf-8');
  const result = parseCsv(csv);
  console.log('\n=== ' + f.slice(0, 8) + ' ===');
  console.log('Format:', result.format);
  console.log('Transactions:', result.transactions.length);
  console.log('Skipped:', result.skippedRows);
  console.log('Errors:', result.errors);
  result.transactions.forEach((t, i) => {
    console.log(i, t.date.toISOString().split('T')[0], t.amount, t.name.slice(0, 60));
  });
}
