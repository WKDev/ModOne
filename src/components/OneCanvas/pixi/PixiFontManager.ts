import { BitmapFont, TextStyle } from 'pixi.js';

export const FONT_LABEL = 'EDA-Label';
export const FONT_DESIGNATION = 'EDA-Designation';
export const FONT_VALUE = 'EDA-Value';

let fontsInstalled = false;

export function ensureFontsInstalled(): void {
  if (fontsInstalled) {
    return;
  }

  BitmapFont.install({
    name: FONT_LABEL,
    style: new TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 10,
      fill: 0xaaaaaa,
    }),
  });

  BitmapFont.install({
    name: FONT_DESIGNATION,
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 11,
      fill: 0x9ca3af,
    }),
  });

  BitmapFont.install({
    name: FONT_VALUE,
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 9,
      fill: 0x888888,
    }),
  });

  fontsInstalled = true;
}
