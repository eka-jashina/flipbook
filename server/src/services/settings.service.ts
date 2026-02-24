import { getPrisma } from '../utils/prisma.js';
import type { GlobalSettingsDetail, SettingsVisibility } from '../types/api.js';

const DEFAULTS: GlobalSettingsDetail = { fontMin: 14, fontMax: 22, settingsVisibility: { fontSize: true, theme: true, font: true, fullscreen: true, sound: true, ambient: true } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSettings(s: any): GlobalSettingsDetail {
  return { fontMin: s.fontMin, fontMax: s.fontMax, settingsVisibility: { fontSize: s.visFontSize, theme: s.visTheme, font: s.visFont, fullscreen: s.visFullscreen, sound: s.visSound, ambient: s.visAmbient } };
}

export async function getGlobalSettings(userId: string): Promise<GlobalSettingsDetail> {
  const prisma = getPrisma();
  const settings = await prisma.globalSettings.findUnique({ where: { userId } });
  if (!settings) return DEFAULTS;
  return mapSettings(settings);
}

export async function updateGlobalSettings(userId: string, data: { fontMin?: number; fontMax?: number; settingsVisibility?: Partial<SettingsVisibility> }): Promise<GlobalSettingsDetail> {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};
  if (data.fontMin !== undefined) updateData.fontMin = data.fontMin;
  if (data.fontMax !== undefined) updateData.fontMax = data.fontMax;
  if (data.settingsVisibility) {
    const vis = data.settingsVisibility;
    if (vis.fontSize !== undefined) updateData.visFontSize = vis.fontSize;
    if (vis.theme !== undefined) updateData.visTheme = vis.theme;
    if (vis.font !== undefined) updateData.visFont = vis.font;
    if (vis.fullscreen !== undefined) updateData.visFullscreen = vis.fullscreen;
    if (vis.sound !== undefined) updateData.visSound = vis.sound;
    if (vis.ambient !== undefined) updateData.visAmbient = vis.ambient;
  }
  const settings = await prisma.globalSettings.upsert({ where: { userId }, create: { userId, ...updateData }, update: updateData });
  return mapSettings(settings);
}
