/**
 * Test fixtures: build genuinely digitally-signed PDFs so the signature
 * verifier can be exercised without shipping a real government document.
 */
import forge from 'node-forge';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';

/** Build a byte-exact minimal one-page PDF (valid cross-reference table). */
function buildMinimalPdf(): Buffer {
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    '<</Length 44>>\nstream\nBT /F1 18 Tf 20 150 Td (Test document) Tj ET\nendstream',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}

export const MINIMAL_PDF = buildMinimalPdf();

interface CertNames {
  subjectCN: string;
  issuerCN: string;
  issuerO?: string;
}

function buildP12({ subjectCN, issuerCN, issuerO }: CertNames): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000 * 365);
  cert.setSubject([{ name: 'commonName', value: subjectCN }]);
  cert.setIssuer([
    { name: 'commonName', value: issuerCN },
    ...(issuerO ? [{ name: 'organizationName', value: issuerO }] : []),
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'pw', { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
}

/** Return a PDF signed by a certificate with the given names. */
export async function makeSignedPdf(names: CertNames, base: Buffer = MINIMAL_PDF): Promise<Buffer> {
  const p12 = buildP12(names);
  const withPlaceholder = plainAddPlaceholder({
    pdfBuffer: base,
    reason: 'Issued document',
    contactInfo: 'issuer@example.gov.in',
    name: names.subjectCN,
    location: 'India',
  });
  const signer = new P12Signer(p12, { passphrase: 'pw' });
  return new SignPdf().sign(withPlaceholder, signer);
}

/** A DigiLocker-style issuer-verified PDF. */
export const makeDigiLockerPdf = () =>
  makeSignedPdf({
    subjectCN: 'NeGD Signer',
    issuerCN: 'DigiLocker Sub CA 2022',
    issuerO: 'National e-Governance Division',
  });

/** A self-signed PDF (intact signature, unconfirmed signer). */
export const makeSelfSignedPdf = () =>
  makeSignedPdf({ subjectCN: 'Some User', issuerCN: 'Some User' });
