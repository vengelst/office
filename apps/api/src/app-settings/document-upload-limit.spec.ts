/**
 * Unit-Tests: Upload-Limit-Parser (Pläne/Dokumente).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_DOCUMENT_UPLOAD_MAX_MB,
  MAX_DOCUMENT_UPLOAD_MAX_MB,
  MIN_DOCUMENT_UPLOAD_MAX_MB,
  documentUploadMaxBytes,
  documentUploadTooLargeMessage,
  parseDocumentUploadMaxMb,
} from './document-upload-limit';

describe('parseDocumentUploadMaxMb', () => {
  it('Default bei fehlend/ungültig', () => {
    assert.equal(parseDocumentUploadMaxMb(null), DEFAULT_DOCUMENT_UPLOAD_MAX_MB);
    assert.equal(parseDocumentUploadMaxMb(undefined), DEFAULT_DOCUMENT_UPLOAD_MAX_MB);
    assert.equal(parseDocumentUploadMaxMb(''), DEFAULT_DOCUMENT_UPLOAD_MAX_MB);
    assert.equal(parseDocumentUploadMaxMb('abc'), DEFAULT_DOCUMENT_UPLOAD_MAX_MB);
    assert.equal(parseDocumentUploadMaxMb('3.5'), DEFAULT_DOCUMENT_UPLOAD_MAX_MB);
  });

  it('akzeptiert gültige Werte im Clamp 5–64', () => {
    assert.equal(parseDocumentUploadMaxMb('5'), MIN_DOCUMENT_UPLOAD_MAX_MB);
    assert.equal(parseDocumentUploadMaxMb('50'), 50);
    assert.equal(parseDocumentUploadMaxMb('64'), MAX_DOCUMENT_UPLOAD_MAX_MB);
  });

  it('außerhalb 5–64 → Default (kein stilles Clamping beim Parse)', () => {
    assert.equal(parseDocumentUploadMaxMb('4'), DEFAULT_DOCUMENT_UPLOAD_MAX_MB);
    assert.equal(parseDocumentUploadMaxMb('65'), DEFAULT_DOCUMENT_UPLOAD_MAX_MB);
    assert.equal(parseDocumentUploadMaxMb('100'), DEFAULT_DOCUMENT_UPLOAD_MAX_MB);
    assert.equal(parseDocumentUploadMaxMb('0'), DEFAULT_DOCUMENT_UPLOAD_MAX_MB);
    assert.equal(parseDocumentUploadMaxMb('-10'), DEFAULT_DOCUMENT_UPLOAD_MAX_MB);
  });
});

describe('documentUploadMaxBytes / Fehlertext', () => {
  it('rechnet MB in Bytes um', () => {
    assert.equal(documentUploadMaxBytes(50), 50 * 1024 * 1024);
    assert.equal(documentUploadMaxBytes(64), 64 * 1024 * 1024);
  });

  it('deutsche Fehlermeldung mit/ohne Ist-Größe', () => {
    assert.equal(
      documentUploadTooLargeMessage(50),
      'Datei überschreitet 50 MB',
    );
    assert.equal(
      documentUploadTooLargeMessage(50, 55 * 1024 * 1024),
      'Datei überschreitet 50 MB (55.0 MB)',
    );
  });
});
