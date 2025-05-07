import { syntaxHighlight } from '../utils/jsonUtils.js';

export class DocumentView {
  constructor() {
    this.currentView = 'json';
    this.currentDocuments = [];
    this.documentView = document.getElementById('document-view');
  }

  switchView(view) {
    this.currentView = view;
    const tableViewBtn = document.getElementById('table-view-btn');
    const jsonViewBtn = document.getElementById('json-view-btn');

    if (view === 'table') {
      tableViewBtn.classList.add('active');
      jsonViewBtn.classList.remove('active');
    } else {
      tableViewBtn.classList.remove('active');
      jsonViewBtn.classList.add('active');
    }

    if (this.currentDocuments) {
      this.displayDocuments(this.currentDocuments);
    }
  }

  displayDocuments(documents) {
    this.currentDocuments = documents;
    this.documentView.innerHTML = '';

    if (Array.isArray(documents) && documents.length > 0) {
      if (this.currentView === 'table') {
        this.displayTableView(documents);
      } else {
        this.displayJSONView(documents);
      }
    } else {
      this.documentView.innerHTML = '<p>No documents found or invalid data received.</p>';
      console.log('Documents data:', documents);
    }
  }

  displayTableView(documents) {
    this.documentView.innerHTML = '<table id="documents-table"></table>';
    const table = document.getElementById('documents-table');

    const headers = ['_id', ...new Set(documents.flatMap(doc => Object.keys(doc)).filter(key => key !== '_id'))];
    const headerRow = table.insertRow();
    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    });

    documents.forEach(doc => {
      const row = table.insertRow();
      headers.forEach(header => {
        const cell = row.insertCell();
        const value = doc[header];
        cell.textContent = typeof value === 'object' ? JSON.stringify(value) : String(value);
      });

      const actionsCell = row.insertCell();
      actionsCell.innerHTML = `
        <button class="edit-btn" data-id="${doc._id}"><i class="fas fa-edit"></i></button>
        <button class="delete-btn" data-id="${doc._id}"><i class="fas fa-trash-alt"></i></button>
      `;
    });
  }

  displayJSONView(documents) {
    this.documentView.innerHTML = documents.map(doc => `
      <div class="document-item">
        <pre>${syntaxHighlight(doc)}</pre>
        <div class="document-actions">
          <button class="edit-btn" data-id="${doc._id}">
            <i class="fas fa-edit"></i>
            Edit
          </button>
          <button class="delete-btn" data-id="${doc._id}">
            <i class="fas fa-trash-alt"></i>
            Delete
          </button>
        </div>
      </div>
    `).join('');
  }

  getTableHeaders(documents) {
    const headers = new Set();
    documents.forEach(doc => {
      Object.keys(doc).forEach(key => headers.add(key));
    });
    return Array.from(headers);
  }

  formatTableCell(value) {
    if (value === null) return '<span class="null-value">null</span>';
    if (value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return value.toString();
  }
} 