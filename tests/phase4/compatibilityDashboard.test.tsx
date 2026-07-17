import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompatibilityDashboardModal } from '../../components/CompatibilityDashboardModal';
import { MainMenuModal } from '../../components/MainMenuModal';

const noOp = () => {};

describe('Phase 4 Compatibility Lab', () => {
  it('renders separated evidence states for the active device without a compatibility percentage', () => {
    const markup = renderToStaticMarkup(
      <CompatibilityDashboardModal
        isOpen
        onClose={noOp}
        initialDeviceId="apple-ipod-video-5g"
      />
    );
    expect(markup).toContain('Compatibility Lab');
    expect(markup).toContain('Source safe');
    expect(markup).toContain('Official evidence');
    expect(markup).toContain('193/193');
    expect(markup).toContain('0 unclassified');
    expect(markup).not.toContain('Compatibility:');
  });

  it('keeps detailed compatibility progressively disclosed behind the project menu', () => {
    const markup = renderToStaticMarkup(
      <MainMenuModal
        isOpen
        onClose={noOp}
        onNew={noOp}
        onOpen={noOp}
        onSave={noOp}
        onExport={noOp}
        onImportZip={noOp}
        onShowFonts={noOp}
        onShowAssets={noOp}
        onShowCompatibility={noOp}
        onShowFirmware={noOp}
      />
    );
    expect(markup).toContain('Compatibility Lab');
    expect(markup).toContain('Official parser and pixel evidence');
  });
});
