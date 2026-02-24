export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export interface UserResponse {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
  hasGoogle: boolean;
}

export interface AuthResponse {
  user: UserResponse;
}

export interface BookListItem {
  id: string;
  title: string;
  author: string;
  position: number;
  chaptersCount: number;
  coverBgMode: string;
  appearance: {
    light: {
      coverBgStart: string;
      coverBgEnd: string;
      coverText: string;
    };
  } | null;
  readingProgress: {
    page: number;
    updatedAt: string;
  } | null;
}

export interface BookDetail {
  id: string;
  title: string;
  author: string;
  cover: {
    bg: string;
    bgMobile: string;
    bgMode: string;
    bgCustomUrl: string | null;
  };
  chapters: ChapterListItem[];
  defaultSettings: DefaultSettings | null;
  appearance: AppearanceDetail | null;
  sounds: SoundsDetail | null;
  ambients: AmbientItem[];
  decorativeFont: { name: string; fileUrl: string } | null;
}

export interface ChapterListItem {
  id: string;
  title: string;
  position: number;
  filePath: string | null;
  hasHtmlContent: boolean;
  bg: string;
  bgMobile: string;
}

export interface ChapterDetail extends ChapterListItem {
  htmlContent: string | null;
}

export interface DefaultSettings {
  font: string;
  fontSize: number;
  theme: string;
  soundEnabled: boolean;
  soundVolume: number;
  ambientType: string;
  ambientVolume: number;
}

export interface AppearanceDetail {
  fontMin: number;
  fontMax: number;
  light: ThemeAppearance;
  dark: ThemeAppearance;
}

export interface ThemeAppearance {
  coverBgStart: string;
  coverBgEnd: string;
  coverText: string;
  coverBgImageUrl: string | null;
  pageTexture: string;
  customTextureUrl: string | null;
  bgPage: string;
  bgApp: string;
}

export interface SoundsDetail {
  pageFlip: string;
  bookOpen: string;
  bookClose: string;
}

export interface AmbientItem {
  id: string;
  ambientKey: string;
  label: string;
  shortLabel: string | null;
  icon: string | null;
  fileUrl: string | null;
  visible: boolean;
  builtin: boolean;
  position: number;
}
