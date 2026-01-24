/**
 * ERROR HANDLER
 * Централизованная обработка и отображение ошибок.
 */

export class ErrorHandler {
  static show(message) {
    const error = document.getElementById('errorMessage');
    const text = document.getElementById('errorText');
    
    // Fallback на старое поведение если элементы не найдены
    if (!error || !text) {
      console.error('Error message container not found in DOM');
      this._showFallback(message);
      return;
    }
    
    text.textContent = message;
    error.hidden = false;
    
    setTimeout(() => {
      error.hidden = true;
    }, 5000);
  }

  static handle(error, userMessage = "Произошла ошибка") {
    console.error("Error:", error);
    this.show(userMessage);
  }

  // Fallback для обратной совместимости
  static _showFallback(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    errorDiv.setAttribute("role", "alert");
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }
}
