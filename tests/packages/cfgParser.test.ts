import { describe, expect, it } from 'vitest';
import {
  getCfgValues,
  parseCfg,
  serializeCfg,
  updateCfgSetting
} from '../../rockbox/packages';

describe('source-preserving CFG parser', () => {
  it('preserves comments, duplicates, unknown settings, whitespace, CRLF, and colons', () => {
    const source = '# note\r\nwps : /.rockbox/wps/a.wps\r\nunknown: value:with:colons\r\nwps: second.wps\r\n\r\n';
    const document = parseCfg(source);

    expect(serializeCfg(document)).toBe(source);
    expect(document.newline).toBe('\r\n');
    expect(getCfgValues(document, 'wps')).toEqual(['/.rockbox/wps/a.wps', 'second.wps']);
  });

  it('updates only the final matching setting and preserves formatting', () => {
    const source = 'wps: first.wps\nunknown : keep\nwps : old.wps  ';
    const changed = updateCfgSetting(parseCfg(source), 'wps', 'new.wps');
    expect(serializeCfg(changed)).toBe('wps: first.wps\nunknown : keep\nwps : new.wps  ');
  });
});
