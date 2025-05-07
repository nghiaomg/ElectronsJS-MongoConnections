export class Modal {
  constructor() {
    this.modal = document.getElementById("modal-container");
    this.modalContent = this.modal.querySelector(".modal-content");
    this.editor = null;
  }

  show() {
    this.modal.style.display = "flex";
  }

  close() {
    this.modal.style.display = "none";
    this.modalContent.innerHTML = "";
    if (this.editor) {
      this.editor = null;
    }
  }

  setContent(content) {
    this.modalContent.innerHTML = content;
  }

  initializeCodeMirror(initialValue = '') {
    // Ensure the editor container exists
    const editorContainer = document.getElementById('code-editor');
    if (!editorContainer) {
      console.error('Code editor container not found');
      return;
    }

    // Create a new textarea for CodeMirror
    const textarea = document.createElement('textarea');
    editorContainer.appendChild(textarea);

    // Initialize CodeMirror with the textarea
    this.editor = CodeMirror.fromTextArea(textarea, {
      mode: 'application/json',
      theme: 'dracula',
      lineNumbers: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      tabSize: 2,
      gutters: ['CodeMirror-linenumbers'],
      lineWrapping: true,
      viewportMargin: Infinity,
      extraKeys: {
        'Ctrl-Space': 'autocomplete',
        'Tab': (cm) => {
          if (cm.somethingSelected()) {
            cm.indentSelection('add');
          } else {
            cm.replaceSelection('  ');
          }
        }
      }
    });

    // Set initial value and refresh immediately
    this.editor.setValue(initialValue);
    
    // Force a refresh after a brief delay to ensure proper rendering
    setTimeout(() => {
      this.editor.refresh();
      this.editor.focus();
    }, 10);

    // Add auto-height functionality
    this.editor.on('change', () => {
      this.editor.setSize('100%', 'auto');
    });

    return this.editor;
  }

  getEditor() {
    return this.editor;
  }
} 