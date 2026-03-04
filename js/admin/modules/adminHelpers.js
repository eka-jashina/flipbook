/**
 * Общие хелперы для admin-модулей
 * Извлечены из повторяющихся паттернов в ChaptersModule, FontsModule,
 * SoundsModule, AmbientsModule, AppearanceModule, BookUploadManager
 */

/**
 * Прочитать файл как data URL через FileReader
 * @param {File} file
 * @returns {Promise<string>} data URL
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Настроить dropzone: клик → file input, drag-and-drop → callback
 * @param {HTMLElement} dropzoneEl - Зона перетаскивания
 * @param {HTMLInputElement} fileInputEl - Скрытый file input
 * @param {(file: File) => void} onFile - Callback при выборе файла
 */
export function setupDropzone(dropzoneEl, fileInputEl, onFile) {
  dropzoneEl.addEventListener('click', () => fileInputEl.click());

  dropzoneEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzoneEl.classList.add('dragover');
  });

  dropzoneEl.addEventListener('dragleave', () => {
    dropzoneEl.classList.remove('dragover');
  });

  dropzoneEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzoneEl.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  });
}
