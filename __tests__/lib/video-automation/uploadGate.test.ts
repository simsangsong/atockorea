/**
 * The review gate a produced short has to pass (VP-D10).
 *
 * Batch and single-POI runs share one uploader, so this is the only place the
 * "failed never uploads / warnings need a human" rule is expressed.
 */

import { assertQcAllowsUpload, QcGateError, type QcFile } from '@/lib/video-automation/upload.server';

function qc(status: QcFile['status'], checks: QcFile['checks'] = []): QcFile {
  return { poiId: 'jagalchi_market', version: 1, status, checks };
}

describe('assertQcAllowsUpload', () => {
  it('lets a clean run through', () => {
    expect(() => assertQcAllowsUpload(qc('passed'), false)).not.toThrow();
  });

  it('never uploads a failed run, even with --allow-warnings', () => {
    const failed = qc('failed', [{ name: 'render_en', status: 'failed', detail: 'ffmpeg render failed' }]);
    expect(() => assertQcAllowsUpload(failed, false)).toThrow(QcGateError);
    expect(() => assertQcAllowsUpload(failed, true)).toThrow(/render_en/);
  });

  it('holds a warning run until a human passes --allow-warnings', () => {
    const warned = qc('warning', [
      { name: 'narration_mode', status: 'warning', detail: 'Silent placeholder narration' },
      { name: 'image_license', status: 'warning', detail: '2 image(s) with unreviewed license' },
    ]);
    expect(() => assertQcAllowsUpload(warned, false)).toThrow(/--allow-warnings/);
    expect(() => assertQcAllowsUpload(warned, false)).toThrow(/image_license/);
    expect(() => assertQcAllowsUpload(warned, true)).not.toThrow();
  });
});
