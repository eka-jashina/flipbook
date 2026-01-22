/**
 * ERROR HANDLER
 * Централизованная обработка и отображение ошибок.
 */

export class ErrorHandler {
  static show(message) {
    const existing = document.querySelector(".error-message");
    if (existing) existing.remove();

    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    errorDiv.setAttribute("role", "alert");
    document.body.appendChild(errorDiv);

    setTimeout(() => errorDiv.remove(), 5000);
  }

  static handle(error, userMessage = "Произошла ошибка") {
    console.error("Error:", error);
    this.show(userMessage);
  }
}
