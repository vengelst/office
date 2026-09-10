import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isVersionNewer } from './version-compare';

describe('isVersionNewer', () => {
  it('erkennt höhere Major/Minor/Patch', () => {
    assert.equal(isVersionNewer('1.3.0', '1.0.0'), true);
    assert.equal(isVersionNewer('1.2.1', '1.2.0'), true);
    assert.equal(isVersionNewer('2.0.0', '1.9.9'), true);
  });

  it('gibt false bei gleich oder älter', () => {
    assert.equal(isVersionNewer('1.3.0', '1.3.0'), false);
    assert.equal(isVersionNewer('1.0.0', '1.3.0'), false);
  });
});
