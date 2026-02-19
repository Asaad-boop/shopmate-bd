const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertGroup(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' And ' + convertGroup(n % 100) : '');
}

export function numberToWords(num: number | null | undefined): string {
  if (num == null || num === 0) return 'Zero';
  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero';

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remainder = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(convertGroup(crore) + ' Crore');
  if (lakh) parts.push(convertGroup(lakh) + ' Lakh');
  if (thousand) parts.push(convertGroup(thousand) + ' Thousand');
  if (remainder) parts.push(convertGroup(remainder));

  return parts.join(', ');
}
