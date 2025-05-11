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

  // Hiển thị thông báo lỗi dưới dạng toast popup
  showError(errorTitle, errorMessage, operation = null) {
    // Kiểm tra xem có modal đang mở không
    const activeModal = document.querySelector('.modal[style*="display: flex"]');
    
    // Tạo toast element
    const toast = document.createElement("div");
    toast.className = "error-toast";
    
    // Điều chỉnh vị trí nếu có modal đang mở
    if (activeModal) {
      // Hiển thị ở phía trên bên phải thay vì dưới
      toast.style.bottom = "auto";
      toast.style.top = "70px";
      toast.style.right = "20px";
    }

    // Icon lỗi
    const icon = document.createElement("i");
    icon.className = "fas fa-exclamation-circle";

    // Nội dung
    const content = document.createElement("div");
    content.className = "toast-content";

    // Tiêu đề
    const title = document.createElement("div");
    title.className = "toast-title";
    title.textContent = errorTitle || "Lỗi xảy ra";

    // Chi tiết lỗi
    const message = document.createElement("div");
    message.textContent = this.formatErrorMessage(errorMessage, operation);

    // Nút đóng
    const closeBtn = document.createElement("button");
    closeBtn.className = "toast-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", () => this.closeErrorToast(toast));

    // Cấu trúc element
    content.appendChild(title);
    content.appendChild(message);
    toast.appendChild(icon);
    toast.appendChild(content);
    toast.appendChild(closeBtn);

    // Thêm vào body
    document.body.appendChild(toast);

    // Tự động đóng sau 8 giây
    setTimeout(() => {
      if (document.body.contains(toast)) {
        this.closeErrorToast(toast);
      }
    }, 8000);

    return toast;
  }

  // Đóng error toast
  closeErrorToast(toast) {
    toast.classList.add("closing");
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }

  // Format thông báo lỗi cho đẹp hơn
  formatErrorMessage(errorMsg, operation) {
    if (!errorMsg) return "Đã xảy ra lỗi không xác định";

    // Tạo phiên bản đẹp hơn của thông báo lỗi
    let message = errorMsg;

    // Trích xuất các thông tin hữu ích từ lỗi
    if (message.includes("Only read operations")) {
      return "MongoDB chỉ cho phép các thao tác đọc (find, aggregate, countDocuments, distinct) trong chế độ này. Vui lòng sử dụng truy vấn khác.";
    }

    if (operation) {
      message = `Lỗi khi ${operation}: ${message}`;
    }

    return message;
  }

  // Hiển thị lỗi trong một container nhất định
  showErrorInContainer(
    container,
    errorTitle,
    errorMessage,
    errorDetails = null
  ) {
    // Xóa nội dung cũ trong container
    container.innerHTML = "";
    container.style.display = "block";

    // Thêm tiêu đề lỗi nếu có
    if (errorTitle) {
      const title = document.createElement("span");
      title.className = "error-title";
      title.textContent = errorTitle;
      container.appendChild(title);
    }

    // Thêm thông báo lỗi chính
    const message = document.createElement("span");
    message.textContent = errorMessage;
    container.appendChild(message);

    // Thêm chi tiết lỗi nếu có
    if (errorDetails) {
      const details = document.createElement("div");
      details.className = "error-details";
      details.textContent = errorDetails;
      container.appendChild(details);
    }

    // Thêm thông tin trợ giúp
    if (errorMessage.includes("Only read operations")) {
      const help = document.createElement("span");
      help.className = "error-help";
      help.textContent =
        "Gợi ý: Hãy sử dụng các lệnh find, aggregate, countDocuments hoặc distinct thay vì lệnh cập nhật/xóa.";
      container.appendChild(help);
    }

    return container;
  }
}
