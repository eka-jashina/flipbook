/**
 * Константы и чистые утилиты фотоальбома
 */

/** Количество изображений для каждого шаблона */
export const LAYOUT_IMAGE_COUNT = {
  '1': 1, '2': 2, '2h': 2,
  '3': 3, '3r': 3, '3t': 3, '3b': 3,
  '4': 4,
};

/** Максимальный размер длинной стороны изображения (px) */
export const IMAGE_MAX_DIMENSION = 1920;

/** Качество JPEG-сжатия (0–1) */
export const IMAGE_QUALITY = 0.85;

/** Максимальный размер загружаемого файла до сжатия (10 МБ) */
export const IMAGE_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Доступные рамки для фотографий */
export const FRAME_OPTIONS = [
  { id: 'none', label: 'Без рамки' },
  { id: 'thin', label: 'Тонкая' },
  { id: 'shadow', label: 'Тень' },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'rounded', label: 'Скруглённая' },
  { id: 'double', label: 'Двойная' },
];

/** Доступные фильтры для фотографий */
export const FILTER_OPTIONS = [
  { id: 'none', label: 'Без фильтра' },
  { id: 'grayscale', label: 'Ч/Б' },
  { id: 'sepia', label: 'Сепия' },
  { id: 'contrast', label: 'Контраст' },
  { id: 'warm', label: 'Тёплый' },
  { id: 'cool', label: 'Холодный' },
];

/** Допустимые значения поворота (градусы) */
export const ROTATION_VALUES = [0, 90, 180, 270];

/** Интенсивность фильтра по умолчанию (100 = максимальный эффект) */
export const DEFAULT_FILTER_INTENSITY = 100;

/**
 * Получить слоты изображений для страницы — всегда length === LAYOUT_IMAGE_COUNT
 */
export function getPageSlots(page) {
  const count = LAYOUT_IMAGE_COUNT[page.layout] || 1;
  return Array.from({ length: count }, (_, i) => page.images[i] || null);
}

/**
 * Вычислить inline CSS filter для изображения
 * @param {string} filter - id фильтра (none, grayscale, sepia, contrast, warm, cool)
 * @param {number} intensity - интенсивность 0–100
 * @returns {string} значение CSS filter или пустая строка
 */
export function computeFilterStyle(filter, intensity) {
  if (!filter || filter === 'none') return '';
  const t = Math.max(0, Math.min(100, intensity ?? DEFAULT_FILTER_INTENSITY)) / 100;
  switch (filter) {
    case 'grayscale': return `grayscale(${t})`;
    case 'sepia': return `sepia(${+(t * 0.75).toFixed(3)})`;
    case 'contrast': return `contrast(${+(1 + t * 0.35).toFixed(3)})`;
    case 'warm': return `saturate(${+(1 + t * 0.3).toFixed(3)}) hue-rotate(${+(-t * 10).toFixed(2)}deg)`;
    case 'cool': return `saturate(${+(1 + t * 0.1).toFixed(3)}) hue-rotate(${+(t * 15).toFixed(2)}deg) brightness(${+(1 + t * 0.05).toFixed(3)})`;
    default: return '';
  }
}
