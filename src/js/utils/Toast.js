export class Toast {
  constructor() {
    this.createToastContainer();
  }

  createToastContainer() {
    const existingContainer = document.getElementById("toast-container");
    if (!existingContainer) {
      const container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }
  }

  show(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icon = document.createElement("i");
    icon.className = `fas ${
      type === "success" ? "fa-check-circle" : "fa-exclamation-circle"
    }`;

    const messageSpan = document.createElement("span");
    messageSpan.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(messageSpan);
    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
      toast.classList.add("show");
    }, 100);

    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        container.removeChild(toast);
      }, 300);
    }, 3000);
  }
}
