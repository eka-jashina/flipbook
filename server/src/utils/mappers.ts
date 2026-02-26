import type {
  BookAppearance,
  BookSounds,
  BookDefaultSettings,
  Ambient,
  Chapter,
  DecorativeFont,
} from '@prisma/client';
import type {
  AppearanceDetail,
  SoundsDetail,
  DefaultSettings,
  AmbientItem,
  ChapterListItem,
} from '../types/api.js';

export function mapAppearanceToDto(a: BookAppearance): AppearanceDetail {
  return {
    fontMin: a.fontMin,
    fontMax: a.fontMax,
    light: {
      coverBgStart: a.lightCoverBgStart,
      coverBgEnd: a.lightCoverBgEnd,
      coverText: a.lightCoverText,
      coverBgImageUrl: a.lightCoverBgImageUrl,
      pageTexture: a.lightPageTexture,
      customTextureUrl: a.lightCustomTextureUrl,
      bgPage: a.lightBgPage,
      bgApp: a.lightBgApp,
    },
    dark: {
      coverBgStart: a.darkCoverBgStart,
      coverBgEnd: a.darkCoverBgEnd,
      coverText: a.darkCoverText,
      coverBgImageUrl: a.darkCoverBgImageUrl,
      pageTexture: a.darkPageTexture,
      customTextureUrl: a.darkCustomTextureUrl,
      bgPage: a.darkBgPage,
      bgApp: a.darkBgApp,
    },
  };
}

export function mapSoundsToDto(s: BookSounds): SoundsDetail {
  return {
    pageFlip: s.pageFlipUrl,
    bookOpen: s.bookOpenUrl,
    bookClose: s.bookCloseUrl,
  };
}

export function mapDefaultSettingsToDto(ds: BookDefaultSettings): DefaultSettings {
  return {
    font: ds.font,
    fontSize: ds.fontSize,
    theme: ds.theme,
    soundEnabled: ds.soundEnabled,
    soundVolume: ds.soundVolume,
    ambientType: ds.ambientType,
    ambientVolume: ds.ambientVolume,
  };
}

export function mapAmbientToDto(a: Ambient): AmbientItem {
  return {
    id: a.id,
    ambientKey: a.ambientKey,
    label: a.label,
    shortLabel: a.shortLabel,
    icon: a.icon,
    fileUrl: a.fileUrl,
    visible: a.visible,
    builtin: a.builtin,
    position: a.position,
  };
}

export function mapChapterToListItem(ch: Chapter): ChapterListItem {
  return {
    id: ch.id,
    title: ch.title,
    position: ch.position,
    filePath: ch.filePath,
    hasHtmlContent: ch.htmlContent !== null,
    bg: ch.bg,
    bgMobile: ch.bgMobile,
  };
}

export function mapDecorativeFontToDto(df: DecorativeFont): { name: string; fileUrl: string } {
  return {
    name: df.name,
    fileUrl: df.fileUrl,
  };
}
