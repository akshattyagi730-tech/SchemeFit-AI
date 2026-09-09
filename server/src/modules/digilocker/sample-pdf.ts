/**
 * Build a tiny, valid one-page PDF for the DigiLocker mock. These stand in for
 * the real issuer-signed PDFs the live Issued Documents API returns; the mock
 * import path marks them issuer-verified because in the real flow the API — not
 * a signature check — is the trust anchor.
 */
export function buildSamplePdf(title: string, lines: string[]): Buffer {
  const text = [title, '', ...lines];
  const content =
    'BT /F1 16 Tf 40 300 Td 20 TL ' +
    text.map((l, i) => `${i === 0 ? '' : 'T* '}(${l.replace(/([()\\])/g, '\\$1')}) Tj`).join(' ') +
    ' ET';
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 360]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}
