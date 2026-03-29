'use strict';

class ListWriter {
  constructor() {
    this.tasks = [];
    this.currentFilter = 'all';
    this.searchTerm = '';
    this.undoStack = [];
    this.selectedTasks = new Set();
    this.selectedCount = 0;
    this.isBulkMode = false;
    this.theme = localStorage.getItem('theme') || 'light';
    this.init();
  }

  init() {
    this.loadTasks();
    this.applyTheme();
    this.bindEvents();
    this.updateStats();
    this.render();
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('theme', this.theme);
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme();
  }

  loadTasks() {
    const saved = localStorage.getItem('listwriter-tasks');
    this.tasks = saved ? JSON.parse(saved) : [];
  }

  saveTasks() {
    localStorage.setItem('listwriter-tasks', JSON.stringify(this.tasks));
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1 && date.toDateString() === now.toDateString()) {
      return 'Today ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } else if (diffDays === 1 && date > now) {
      return 'Tomorrow ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } else if (date < now) {
      return diffDays + ' days ago';
    }
    return date.toLocaleDateString();
  }

  isOverdue(taskDate) {
    if (!taskDate) return false;
    const date = new Date(taskDate);
    return date < new Date() && task.completed !== true;
  }

  addTask(e) {
    e.preventDefault();
    const text = document.getElementById('taskText').value.trim();
    if (!text) return;

    const task = {
      id: Date.now().toString(),
      text,
      category: document.getElementById('taskCategory').value,
      priority: document.getElementById('taskPriority').value,
      dueDate: document.getElementById('taskDueDate').value || null,
      notes: document.getElementById('taskNotes').value.trim(),
      file: null,
      completed: false,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    const fileInput = document.getElementById('taskFile');
    if (fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        task.file = {
          name: fileInput.files[0].name,
          type: fileInput.files[0].type,
          data: e.target.result
        };
        this.tasks.unshift(task);
        this.saveTasks();
        this.resetForm();
        this.render();
        this.updateStats();
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      this.tasks.unshift(task);
      this.saveTasks();
      this.resetForm();
      this.render();
      this.updateStats();
    }
  }

  toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      task.updated = new Date().toISOString();
      if (this.selectedTasks.has(id)) this.selectedTasks.delete(id);
      this.saveTasks();
      this.render();
      this.updateStats();
    }
  }

  deleteTask(id) {
    const taskIndex = this.tasks.findIndex(t => t.id === id);
    if (taskIndex > -1) {
      this.undoStack.unshift(this.tasks[taskIndex]);
      this.tasks.splice(taskIndex, 1);
      this.saveTasks();
      this.showUndo();
      this.render();
      this.updateStats();
    }
  }

  // Bulk Actions - NEW FEATURE
  toggleBulkMode() {
    this.isBulkMode = !this.isBulkMode;
    const bulkControls = document.getElementById('bulkControls');
    const bulkBtn = document.getElementById('bulkSelectBtn');
    if (this.isBulkMode) {
      bulkControls.classList.remove('hidden');
      bulkBtn.textContent = '✕ Cancel';
    } else {
      bulkControls.classList.add('hidden');
      bulkBtn.textContent = '☰ Bulk';
      this.clearSelection();
    }
    this.render();
  }

  toggleSelection(id) {
    if (this.selectedTasks.has(id)) {
      this.selectedTasks.delete(id);
    } else {
      this.selectedTasks.add(id);
    }
    this.selectedCount = this.selectedTasks.size;
    document.getElementById('bulkSelection').textContent = `${this.selectedCount} selected`;
    this.render();
  }

  bulkComplete() {
    this.tasks.forEach(task => {
      if (this.selectedTasks.has(task.id)) {
        task.completed = true;
        task.updated = new Date().toISOString();
      }
    });
    this.saveTasks();
    this.clearSelection();
    this.render();
    this.updateStats();
  }

  bulkDelete() {
    const deleted = [];
    this.tasks = this.tasks.filter(task => {
      if (this.selectedTasks.has(task.id)) {
        deleted.push(task);
        return false;
      }
      return true;
    });
    deleted.forEach(task => this.undoStack.unshift(task));
    this.saveTasks();
    this.clearSelection();
    this.showUndo();
    this.render();
    this.updateStats();
  }

  clearSelection() {
    this.selectedTasks.clear();
    this.selectedCount = 0;
    this.isBulkMode = false;
    document.getElementById('bulkControls').classList.add('hidden');
    document.getElementById('bulkSelectBtn').textContent = '☰ Bulk';
    document.getElementById('bulkSelection').textContent = '0 selected';
    this.render();
  }

  undoLast() {
    if (this.undoStack.length > 0) {
      this.tasks.unshift(this.undoStack.shift());
      this.saveTasks();
      this.render();
      this.updateStats();
      this.hideUndo();
    }
  }

  editTask(id, field, value) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task[field] = value;
      task.updated = new Date().toISOString();
      this.saveTasks();
      this.render();
    }
  }

  makeEditable(id, field) {
    const element = document.querySelector(`[ondblclick="app.makeEditable('${id}', '${field}')"]`);
    if (element) {
      element.contentEditable = true;
      element.focus();
      element.onblur = () => {
        element.contentEditable = false;
        app.editTask(id, field, element.textContent.trim());
      };
      element.onkeypress = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          element.blur();
        }
      };
    }
  }

  toggleNotes(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task && task.notes) {
      task.notesExpanded = !task.notesExpanded;
      this.render();
    }
  }

  showFile(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task && task.file) {
      const win = window.open();
      win.document.write(`
        <html><head><title>${task.file.name}</title></head>
        <body style="margin:0;padding:2rem;font-family:sans-serif;background:white;">
          ${task.file.type.startsWith('image/') ? `<img src="${task.file.data}" style="max-width:100%;height:auto;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.3);">` : `<embed src="${task.file.data}" type="${task.file.type}" width="100%" height="600px" style="border-radius:12px;">`}
          <p style="margin-top:1rem;font-weight:bold;">${task.file.name}</p>
        </body></html>
      `);
    }
  }

  getFilteredTasks() {
    return this.tasks.filter(task => {
      const matchesSearch = !this.searchTerm || 
        task.text.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        task.notes?.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesFilter = this.currentFilter === 'all' || 
        task.category === this.currentFilter || 
        task.priority === this.currentFilter;
      return matchesSearch && matchesFilter;
    }).sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const prioA = {high:3, medium:2, low:1}[a.priority] || 1;
      const prioB = {high:3, medium:2, low:1}[b.priority] || 1;
      return prioB - prioA;
    });
  }

  updateStats() {
    const total = this.tasks.length;
    const complete = this.tasks.filter(t => t.completed).length;
    const high = this.tasks.filter(t => t.priority === 'high').length;
    const today = this.tasks.filter(t => {
      if (!t.dueDate) return false;
      const date = new Date(t.dueDate);
      return date.toDateString() === new Date().toDateString();
    }).length;
    const overdue = this.tasks.filter(t => this.isOverdue(t.dueDate)).length;

    document.getElementById('totalCount').textContent = total;
    document.getElementById('completeCount').textContent = complete;
    document.getElementById('priorityHigh').textContent = high;
    document.getElementById('dueToday').textContent = today;
    document.getElementById('overdue').textContent = overdue;
  }

  render() {
    const container = document.getElementById('taskList');
    const filteredTasks = this.getFilteredTasks();
    
    if (filteredTasks.length === 0) {
      container.innerHTML = '<div class="no-tasks">No tasks found</div>';
      return;
    }

    container.innerHTML = filteredTasks.map(task => {
      const isSelected = this.selectedTasks.has(task.id);
      const showBulkCheckbox = this.isBulkMode;
      const showCompleteCheckbox = !this.isBulkMode;
      
      return `
        <li class="task-item priority-${task.priority.toLowerCase()} ${task.completed ? 'completed' : ''} ${this.isOverdue(task.dueDate) ? 'overdue' : ''} ${isSelected ? 'selected' : ''}" data-task-id="${task.id}" draggable="true">
          ${showBulkCheckbox ? `<input type="checkbox" class="task-bulk-checkbox" ${isSelected ? 'checked' : ''} onchange="app.toggleSelection('${task.id}')" title="Select for bulk action">` : ''}
          ${showCompleteCheckbox ? `<input type="checkbox" class="task-complete-checkbox" ${task.completed ? 'checked' : ''} onchange="app.toggleTask('${task.id}')" title="Toggle complete">` : ''}
          <div class="task-main">
            <div class="task-title" ondblclick="app.makeEditable('${task.id}', 'text')" title="Double-click to edit">${task.text}</div>
            <div class="task-meta">
              <span class="badge category">${task.category}</span>
              <span class="badge priority">${task.priority}</span>
              ${task.dueDate ? `<span class="badge date ${this.isOverdue(task.dueDate) ? 'overdue' : ''}" title="Due ${task.dueDate}">${this.formatDate(task.dueDate)}</span>` : ''}
              ${task.notes ? `<span class="badge notes" ondblclick="app.toggleNotes('${task.id}')" title="Notes">📝 ${task.notes.substring(0,20)}${task.notes.length > 20 ? '...' : ''}</span>` : ''}
              ${task.file ? `<span class="badge file" onclick="app.showFile('${task.id}')" title="File attachment">📎 ${task.file.name}</span>` : ''}
            </div>
            ${task.notes && task.notesExpanded ? `<div class="task-notes-expanded">${task.notes}</div>` : ''}
          </div>
          <div class="task-actions">
            ${task.notes ? `<button onclick="app.toggleNotes('${task.id}')" title="Toggle notes">📝</button>` : ''}
            <button onclick="app.deleteTask('${task.id}')" title="Delete (Undo available)">🗑️</button>
          </div>
        </li>
      `;
    }).join('');
  }

  bindEvents() {
    // Form
    document.getElementById('taskForm').onsubmit = (e) => this.addTask(e);
    
    // Bulk mode
    document.getElementById('bulkSelectBtn').onclick = () => this.toggleBulkMode();
    document.getElementById('bulkCompleteAll').onclick = () => this.bulkComplete();
    document.getElementById('bulkDeleteAll').onclick = () => this.bulkDelete();
    document.getElementById('bulkClearSelection').onclick = () => this.clearSelection();
    
    // Header buttons
    document.getElementById('themeToggle').onclick = () => this.toggleTheme();
    document.getElementById('exportBtn').onclick = () => this.exportData();
    document.getElementById('printBtn').onclick = () => window.print();
    document.getElementById('importBtn').onchange = (e) => this.importData(e);
    document.getElementById('undoLastAction').onclick = () => this.undoLast();
    document.getElementById('dismissUndo').onclick = () => this.hideUndo();
    
    // Search & Filters
    document.getElementById('searchInput').oninput = (e) => {
      this.searchTerm = e.target.value;
      this.render();
    };
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter || btn.dataset.priority || btn.dataset.due || 'all';
        this.render();
      };
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isBulkMode) return this.clearSelection();
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'enter') {
          e.preventDefault();
          this.addTask({preventDefault: () => {}});
        } else if (e.key.toLowerCase() === 'b') {
          e.preventDefault();
          this.toggleBulkMode();
        } else if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          this.exportData();
        } else if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          window.print();
        }
      } else if (e.key.toLowerCase() === 't') {
        this.toggleTheme();
      }
    });
  }

  exportData() {
    const dataStr = JSON.stringify(this.tasks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = `listwriter-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
  }

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedTasks = JSON.parse(e.target.result);
        if (Array.isArray(importedTasks)) {
          this.tasks = importedTasks.map(task => ({
            ...task,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            created: new Date().toISOString(),
            updated: new Date().toISOString()
          }));
          this.saveTasks();
          this.render();
          this.updateStats();
          alert(`Imported ${importedTasks.length} tasks`);
        }
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  showUndo() {
    document.getElementById('undoNotification').classList.remove('hidden');
    // Auto dismiss after 5s
    setTimeout(() => this.hideUndo(), 5000);
  }

  hideUndo() {
    document.getElementById('undoNotification').classList.add('hidden');
  }

  resetForm() {
    document.getElementById('taskForm').reset();
  }
}

// Global app instance
const app = new ListWriter();

// Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('SW registered'))
    .catch(err => console.log('SW failed'));
}
