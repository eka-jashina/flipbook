/**
 * ENRICH CONFIG FROM INDEXEDDB
 * Дозагрузка крупных data URL (шрифты, амбиенты, текстуры) из IndexedDB.
 *
 * При сохранении в localStorage крупные data URL вырезаются
 * и заменяются маркером `_idb: true`. Эта функция дозагружает
 * полные данные из IndexedDB и возвращает новый замороженный конфиг.
 *
 * Вызывается один раз при старте ридера, до создания BookController.
 */

import { deepFreeze, getActiveBook } from './configHelpers.js';

/**
 * Обогатить CONFIG данными из IndexedDB.
 *
 * @param {Readonly<Object>} config - Замороженный объект CONFIG
 * @returns {Readonly<Object>} Новый замороженный CONFIG с данными из IDB (или исходный, если IDB не нужна)
 */
export async function enrichConfigFromIDB(config) {
  const appearanceNeedsIdb = ['light', 'dark'].some(theme => {
    const t = config.APPEARANCE?.[theme];
    return t?._idbCoverBgImage || t?._idbCustomTexture;
  });

  const needsIdb =
    config.DECORATIVE_FONT?._idb ||
    config.CUSTOM_FONTS?.some(f => f._idb) ||
    Object.values(config.AMBIENT).some(a => a._idb) ||
    appearanceNeedsIdb;

  if (!needsIdb) return config;

  let adminConfig;
  try {
    const { IdbStorage } = await import('../utils/IdbStorage.js');
    const idb = new IdbStorage('flipbook-admin', 'config');
    adminConfig = await idb.get('flipbook-admin-config');
  } catch {
    return config;
  }
  if (!adminConfig) return config;

  const activeBook = getActiveBook(adminConfig);

  // Декоративный шрифт (иммутабельная копия)
  let decorativeFont = config.DECORATIVE_FONT;
  if (decorativeFont?._idb && activeBook?.decorativeFont?.dataUrl) {
    decorativeFont = { ...decorativeFont, dataUrl: activeBook.decorativeFont.dataUrl };
  }

  // Амбиенты (иммутабельные копии)
  let ambient = config.AMBIENT;
  if (activeBook?.ambients) {
    const ambientMap = new Map(activeBook.ambients.map(a => [a.id, a]));
    const patchedAmbient = {};
    let changed = false;
    for (const [type, cfg] of Object.entries(ambient)) {
      if (cfg._idb) {
        const src = ambientMap.get(type);
        if (src?.file) {
          patchedAmbient[type] = { ...cfg, file: src.file };
          changed = true;
          continue;
        }
      }
      patchedAmbient[type] = cfg;
    }
    if (changed) ambient = patchedAmbient;
  }

  // Пользовательские шрифты для чтения (иммутабельные копии)
  let customFonts = config.CUSTOM_FONTS;
  if (customFonts?.length && adminConfig.readingFonts) {
    const fontMap = new Map(adminConfig.readingFonts.map(f => [f.id, f]));
    customFonts = customFonts.map(font => {
      if (font._idb) {
        const src = fontMap.get(font.id);
        if (src?.dataUrl) {
          return { ...font, dataUrl: src.dataUrl };
        }
      }
      return font;
    });
  }

  // Оформление: coverBgImage и customTextureData (иммутабельные копии)
  let appearance = config.APPEARANCE;
  if (appearanceNeedsIdb && activeBook?.appearance) {
    const patchedAppearance = { ...appearance };
    for (const theme of ['light', 'dark']) {
      const target = appearance[theme];
      const src = activeBook.appearance[theme];
      if (!target || !src) continue;

      let patched = null;
      if (target._idbCoverBgImage && src.coverBgImage) {
        patched = { ...(patched || target), coverBgImage: src.coverBgImage };
      }
      if (target._idbCustomTexture && src.customTextureData) {
        patched = { ...(patched || target), customTextureData: src.customTextureData };
      }
      if (patched) {
        patchedAppearance[theme] = patched;
      }
    }
    appearance = patchedAppearance;
  }

  // Собрать обновлённый конфиг
  return deepFreeze({
    ...config,
    DECORATIVE_FONT: decorativeFont,
    AMBIENT: ambient,
    CUSTOM_FONTS: customFonts,
    APPEARANCE: appearance,
  });
}
