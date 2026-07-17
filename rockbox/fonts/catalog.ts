export const ROCKBOX_FONT_SOURCE_SHA = '078a506dfd0deb18165a3ed80c7fcbdb3afb0d31';

const FONT_PACKAGE_FILENAMES = [
  '05-Tiny.fnt',
  '06-Tiny.fnt',
  '07-Fixed.fnt',
  '08-Atadore.fnt',
  '08-Fixed.fnt',
  '08-Namil.fnt',
  '08-Nedore.fnt',
  '08-Rockbox-Propfont.fnt',
  '08-Rockfont.fnt',
  '08-Sazanami-Mincho.fnt',
  '08-Schumacher-Clean.fnt',
  '09-Fixed.fnt',
  '09-Nedore.fnt',
  '09-Sazanami-Mincho.fnt',
  '09-WenQangYi-Song.fnt',
  '09-WenQangYi-Song-Bold.fnt',
  '10-Adobe-Helvetica.fnt',
  '10-Adobe-Helvetica-Bold.fnt',
  '10-Artwiz-Snap.fnt',
  '10-Fixed.fnt',
  '10-Nimbus.fnt',
  '10-ProFont.fnt',
  '10-Sazanami-Mincho.fnt',
  '10-WenQangYi-Song.fnt',
  '10-WenQangYi-Song-Bold.fnt',
  '11-Nimbus.fnt',
  '11-ProFont.fnt',
  '11-Sazanami-Mincho.fnt',
  '11-WenQangYi-Song.fnt',
  '11-WenQangYi-Song-Bold.fnt',
  '12-Adobe-Helvetica.fnt',
  '12-Adobe-Helvetica-Bold.fnt',
  '12-Fixed-SemiCond.fnt',
  '12-Nimbus.fnt',
  '12-ProFont.fnt',
  '12-Sazanami-Mincho.fnt',
  '12-Terminus.fnt',
  '12-WenQangYi-Song.fnt',
  '12-WenQangYi-Song-Bold.fnt',
  '13-Fixed.fnt',
  '13-Fixed-Bold.fnt',
  '13-Fixed-SemiCond.fnt',
  '13-Fixed-SemiCond-Bold.fnt',
  '13-Nimbus.fnt',
  '13-Sazanami-Mincho.fnt',
  '14-Adobe-Helvetica-Bold.fnt',
  '14-Nimbus.fnt',
  '14-Rockbox-Mix.fnt',
  '14-Sazanami-Mincho.fnt',
  '14-Terminus.fnt',
  '14-Terminus-Bold.fnt',
  '15-Adobe-Helvetica.fnt',
  '15-ProFont.fnt',
  '16-Adobe-Helvetica.fnt',
  '16-Adobe-Helvetica-Bold.fnt',
  '16-GNU-Unifont.fnt',
  '16-Jackash.fnt',
  '16-Terminus.fnt',
  '16-Terminus-Bold.fnt',
  '16-WenQangYi-Unibit.fnt',
  '17-ProFont.fnt',
  '18-Adobe-Helvetica.fnt',
  '18-Adobe-Helvetica-Bold.fnt',
  '18-Fixed.fnt',
  '18-Fixed-Bold.fnt',
  '18-Terminus.fnt',
  '18-Terminus-Bold.fnt',
  '19-Nimbus.fnt',
  '20-Artwiz-Snap.fnt',
  '20-Terminus.fnt',
  '20-Terminus-Bold.fnt',
  '21-Adobe-Helvetica.fnt',
  '21-Adobe-Helvetica-Bold.fnt',
  '22-ProFont.fnt',
  '22-Terminus.fnt',
  '22-Terminus-Bold.fnt',
  '24-Terminus.fnt',
  '24-Terminus-Bold.fnt',
  '27-Adobe-Helvetica.fnt',
  '27-Adobe-Helvetica-Bold.fnt',
  '28-Terminus.fnt',
  '28-Terminus-Bold.fnt',
  '29-ProFont.fnt',
  '32-Terminus.fnt',
  '32-Terminus-Bold.fnt',
  '35-Adobe-Helvetica.fnt',
  '35-Adobe-Helvetica-Bold.fnt',
  '35-Nimbus.fnt'
] as const;

export type RockboxFontCatalogEntry = {
  filename: string;
  sourceFilename: string;
  height: number;
  family: string;
  variant: 'regular' | 'bold' | 'other';
  delivery: 'rockbox-fonts-package';
};

const describeFilename = (filename: string): RockboxFontCatalogEntry => {
  const match = filename.match(/^(\d+)-(.+)\.fnt$/);
  if (!match) throw new Error(`Invalid Rockbox font catalog filename: ${filename}`);
  const family = match[2];
  return {
    filename,
    sourceFilename: filename.replace(/\.fnt$/, '.bdf'),
    height: Number.parseInt(match[1], 10),
    family,
    variant: family.endsWith('-Bold') ? 'bold' : family.includes('-') ? 'other' : 'regular',
    delivery: 'rockbox-fonts-package'
  };
};

/**
 * Filename catalog of the separate Rockbox fonts package at the pinned SHA.
 * It contains metadata only: no BDF/FNT bytes or third-party font license is bundled.
 */
export const ROCKBOX_FONT_CATALOG: RockboxFontCatalogEntry[] = FONT_PACKAGE_FILENAMES.map(describeFilename);
