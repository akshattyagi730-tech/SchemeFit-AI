/**
 * Best-effort verification of the digital signature embedded in a PDF.
 *
 * This does NOT replace the officer review step and never rejects an upload on
 * its own. It answers one question: "were these exact bytes signed, and by whom?"
 * A genuine DigiLocker / government e-signed PDF carries a PKCS#7 (CMS) detached
 * signature whose certificate chains to a CCA-India licensed CA. A PDF exported
 * from a word processor carries no signature at all.
 *
 * Scope / known limitations (acceptable for this project):
 *  - Verifies the primary (last) signature only.
 *  - Trusts the certificate *names*, not a bundled CA trust store — we classify
 *    by recognised issuer/subject strings rather than doing full path validation
 *    with revocation. Integrity (the ByteRange digest) IS checked cryptographically.
 *  - No timestamp-token or LTV validation.
 */
import forge from 'node-forge';
import { createHash } from 'node:crypto';

export type PdfTrustLevel =
  | 'issuer_verified' // signed by a recognised government issuer (DigiLocker, UIDAI, ITD, …)
  | 'e_signed' // validly signed by a recognised Indian licensed CA / eSign service
  | 'signed_untrusted' // a valid signature, but the CA is not one we recognise
  | 'self_signed' // signature is intact but the certificate signs itself
  | 'invalid' // a signature is present but does not verify against the bytes
  | 'unsigned'; // no digital signature found

export interface PdfSignatureResult {
  signed: boolean;
  integrityValid: boolean;
  coversWholeDocument: boolean;
  signerCommonName: string | null;
  issuerCommonName: string | null;
  issuerOrganization: string | null;
  signedAt: string | null;
  trustLevel: PdfTrustLevel;
  authority: string | null;
  reason: string;
}

const UNSIGNED = (reason: string): PdfSignatureResult => ({
  signed: false,
  integrityValid: false,
  coversWholeDocument: false,
  signerCommonName: null,
  issuerCommonName: null,
  issuerOrganization: null,
  signedAt: null,
  trustLevel: 'unsigned',
  authority: reason === '' ? null : null,
  reason: reason || 'No digital signature found in this document.',
});

/**
 * Certificate subject / issuer strings that indicate a Government of India
 * issued or e-signed document. Matched case-insensitively against the CN and O
 * of both the signer and its issuer.
 */
const AUTHORITIES: { pattern: RegExp; label: string; level: 'issuer_verified' | 'e_signed' }[] = [
  { pattern: /digi\s*locker|digilocker/i, label: 'DigiLocker', level: 'issuer_verified' },
  { pattern: /national e-?governance|\bnegd\b/i, label: 'NeGD', level: 'issuer_verified' },
  { pattern: /national informatics|\bnic\b sub-?ca|\bnicca\b/i, label: 'NIC', level: 'issuer_verified' },
  { pattern: /\buidai\b|unique identification/i, label: 'UIDAI', level: 'issuer_verified' },
  { pattern: /income tax department|\bprotean\b|\bnsdl\b e-?gov|\butiitsl\b/i, label: 'Income Tax Department', level: 'issuer_verified' },
  { pattern: /transport department|\bsarathi\b|\bvahan\b|parivahan/i, label: 'Transport Department', level: 'issuer_verified' },
  { pattern: /\bcbse\b|board of secondary education|council for the indian school/i, label: 'Examination Board', level: 'issuer_verified' },
  { pattern: /e-?mudhra/i, label: 'eMudhra CA', level: 'e_signed' },
  { pattern: /\(n\)?code|ncode solutions/i, label: '(n)Code Solutions CA', level: 'e_signed' },
  { pattern: /\bcdac\b|centre for development of advanced computing|c-dac/i, label: 'CDAC eSign', level: 'e_signed' },
  { pattern: /capricorn/i, label: 'Capricorn CA', level: 'e_signed' },
  { pattern: /verasys|pantasign|prodigisign|id\s*sign|xtratrust|safescrypt/i, label: 'Licensed CA (India)', level: 'e_signed' },
  { pattern: /controller of certifying authorities|\bcca india\b/i, label: 'CCA India', level: 'e_signed' },
];

const DIGEST_OID: Record<string, 'sha1' | 'sha256' | 'sha384' | 'sha512'> = {
  '1.3.14.3.2.26': 'sha1',
  '2.16.840.1.101.3.4.2.1': 'sha256',
  '2.16.840.1.101.3.4.2.2': 'sha384',
  '2.16.840.1.101.3.4.2.3': 'sha512',
};

const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';
const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';
const OID_CONTENT_TYPE = '1.2.840.113549.1.9.3';

interface ByteRangeSig {
  byteRange: [number, number, number, number];
  signature: Buffer;
}

/** Locate the primary signature: its ByteRange gaps and the DER signature blob. */
function extractSignature(pdf: Buffer): ByteRangeSig | null {
  const latin1 = pdf.toString('latin1');
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let match: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((match = re.exec(latin1)) !== null) last = match;
  if (!last) return null;

  const [a, b, c, d] = [Number(last[1]), Number(last[2]), Number(last[3]), Number(last[4])];
  if (a !== 0 || b <= 0 || c <= b || d < 0 || c + d > pdf.length) return null;

  // The signature Contents hex string lives in the gap between the two ranges.
  const gap = pdf.slice(a + b, c).toString('latin1');
  const open = gap.indexOf('<');
  const close = gap.lastIndexOf('>');
  if (open === -1 || close <= open) return null;
  const hex = gap.slice(open + 1, close).replace(/[^0-9a-fA-F]/g, '');
  if (hex.length < 2) return null;
  // Trailing zero padding is normal; trim to an even length of non-zero content.
  const trimmed = hex.replace(/(00)+$/i, '');
  const der = Buffer.from(trimmed.length % 2 === 0 ? trimmed : hex, 'hex');
  return { byteRange: [a, b, c, d], signature: der };
}

function signedBytes(pdf: Buffer, [a, b, c, d]: [number, number, number, number]): Buffer {
  return Buffer.concat([pdf.slice(a, a + b), pdf.slice(c, c + d)]);
}

function findAttribute(attrs: forge.asn1.Asn1[], oid: string): forge.asn1.Asn1 | null {
  for (const attr of attrs) {
    // attr = SEQUENCE { OID, SET OF value }
    const seq = attr.value as forge.asn1.Asn1[];
    if (!seq || !seq[0]) continue;
    const attrOid = forge.asn1.derToOid((seq[0].value as string));
    if (attrOid === oid) return attr;
  }
  return null;
}

function attributeValue(attr: forge.asn1.Asn1): forge.asn1.Asn1 | null {
  const seq = attr.value as forge.asn1.Asn1[];
  const set = seq?.[1];
  const val = (set?.value as forge.asn1.Asn1[])?.[0];
  return val ?? null;
}

function cnOf(field: 'subject' | 'issuer', cert: forge.pki.Certificate): { cn: string | null; o: string | null } {
  const src = cert[field];
  const get = (t: string) => {
    const f = src.getField(t);
    return f && typeof f.value === 'string' ? f.value : null;
  };
  return { cn: get('CN'), o: get('O') };
}

function classify(signer: { cn: string | null; o: string | null }, issuer: { cn: string | null; o: string | null }) {
  const haystack = [signer.cn, signer.o, issuer.cn, issuer.o].filter(Boolean).join(' | ');
  for (const a of AUTHORITIES) {
    if (a.pattern.test(haystack)) return { level: a.level, authority: a.label };
  }
  return { level: null as null | 'issuer_verified' | 'e_signed', authority: null as string | null };
}

function parseSigningTime(attr: forge.asn1.Asn1 | null): string | null {
  if (!attr) return null;
  const val = attributeValue(attr);
  if (!val || typeof val.value !== 'string') return null;
  try {
    const d =
      val.type === forge.asn1.Type.UTCTIME
        ? forge.asn1.utcTimeToDate(val.value)
        : forge.asn1.generalizedTimeToDate(val.value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

export function verifyPdfSignature(pdf: Buffer): PdfSignatureResult {
  if (pdf.length < 5 || pdf.toString('latin1', 0, 5) !== '%PDF-') {
    return UNSIGNED('Not a PDF, so it carries no document signature.');
  }

  const sig = extractSignature(pdf);
  if (!sig) return UNSIGNED('No digital signature found — this looks like a plain PDF export.');

  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(sig.signature.toString('binary')));
    const p7 = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData & {
      rawCapture: Record<string, unknown>;
    };
    const rc = p7.rawCapture;
    const certs = (p7.certificates ?? []) as forge.pki.Certificate[];
    const leaf = certs[0];
    if (!leaf || !rc || !rc.signature) {
      return {
        ...UNSIGNED(''),
        signed: true,
        trustLevel: 'invalid',
        reason: 'A signature is present but its structure could not be read.',
      };
    }

    const authAttrs = (rc.authenticatedAttributes as forge.asn1.Asn1[]) ?? [];
    const digestOid = forge.asn1.derToOid(rc.digestAlgorithm as string);
    const digestAlgo = DIGEST_OID[digestOid] ?? 'sha256';

    const content = signedBytes(pdf, sig.byteRange);
    const contentDigest = createHash(digestAlgo).update(content).digest();

    // 1. messageDigest authenticated attribute must equal hash(signed bytes).
    let integrityValid = false;
    if (authAttrs.length) {
      const mdAttr = findAttribute(authAttrs, OID_MESSAGE_DIGEST);
      const mdVal = mdAttr && attributeValue(mdAttr);
      if (mdVal && typeof mdVal.value === 'string') {
        integrityValid = Buffer.from(mdVal.value, 'binary').equals(contentDigest);
      }
      // 2. The signature itself must verify over the DER of the auth-attribute SET.
      if (integrityValid) {
        const set = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, authAttrs);
        const signedAttrDer = forge.asn1.toDer(set).getBytes();
        const md = forge.md[digestAlgo].create();
        md.update(signedAttrDer);
        try {
          integrityValid = (leaf.publicKey as forge.pki.rsa.PublicKey).verify(
            md.digest().getBytes(),
            rc.signature as string,
          );
        } catch {
          integrityValid = false;
        }
      }
    } else {
      // No signed attributes: signature is directly over the content digest.
      try {
        const md = forge.md[digestAlgo].create();
        md.update(content.toString('binary'));
        integrityValid = (leaf.publicKey as forge.pki.rsa.PublicKey).verify(
          md.digest().getBytes(),
          rc.signature as string,
        );
      } catch {
        integrityValid = false;
      }
    }

    const signer = cnOf('subject', leaf);
    const issuer = cnOf('issuer', leaf);
    const selfSigned = signer.cn != null && signer.cn === issuer.cn && signer.o === issuer.o;
    const signedAt =
      parseSigningTime(findAttribute(authAttrs, OID_SIGNING_TIME)) ??
      (leaf.validity?.notBefore ? leaf.validity.notBefore.toISOString() : null);

    const coversWholeDocument = sig.byteRange[2] + sig.byteRange[3] === pdf.length;

    if (!integrityValid) {
      return {
        signed: true,
        integrityValid: false,
        coversWholeDocument,
        signerCommonName: signer.cn,
        issuerCommonName: issuer.cn,
        issuerOrganization: issuer.o,
        signedAt,
        trustLevel: 'invalid',
        authority: null,
        reason: 'A signature is present but it does not match the file contents — the document may have been altered.',
      };
    }

    const { level, authority } = classify(signer, issuer);
    let trustLevel: PdfTrustLevel;
    let reason: string;
    if (level === 'issuer_verified') {
      trustLevel = 'issuer_verified';
      reason = `Digitally signed by ${authority} and unaltered since signing.`;
    } else if (level === 'e_signed') {
      trustLevel = 'e_signed';
      reason = `Validly e-signed via ${authority} and unaltered since signing.`;
    } else if (selfSigned) {
      trustLevel = 'self_signed';
      reason = 'The signature is intact but the certificate is self-issued, so the signer cannot be confirmed.';
    } else {
      trustLevel = 'signed_untrusted';
      reason = 'Digitally signed and unaltered, but the issuing certificate authority is not recognised.';
    }
    if (!coversWholeDocument) {
      reason += ' Note: content was added after signing.';
    }

    return {
      signed: true,
      integrityValid: true,
      coversWholeDocument,
      signerCommonName: signer.cn,
      issuerCommonName: issuer.cn,
      issuerOrganization: issuer.o,
      signedAt,
      trustLevel,
      authority,
      reason,
    };
  } catch {
    return {
      ...UNSIGNED(''),
      signed: true,
      trustLevel: 'invalid',
      reason: 'A signature was found but could not be verified.',
    };
  }
}

/** A signature strong enough for the system to mark the document verified on its own. */
export function isAutoVerifiable(r: PdfSignatureResult): boolean {
  return r.signed && r.integrityValid && r.coversWholeDocument && r.trustLevel === 'issuer_verified';
}
