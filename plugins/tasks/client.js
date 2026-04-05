// Tasks Tab — Tab SDK plugin for Todo list with brag tracking
// Uses localStorage for persistence — no server dependency.
import { registerTab } from '/js/ui/tab-sdk.js';

const ICONS = {
  star: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  archive: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  unarchive: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
  starBrag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  archiveBig: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── localStorage database ───────────────────────────────
const TODOS_KEY = 'claudeck-plugin-tasks-todos';
const BRAGS_KEY = 'claudeck-plugin-tasks-brags';
let _nextId = Date.now();

const db = {
  _load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  },
  _save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  // Todos
  listTodos(archived = false) {
    return this._load(TODOS_KEY).filter(t => !!t.archived === archived);
  },
  createTodo(text) {
    const all = this._load(TODOS_KEY);
    const todo = { id: _nextId++, text, done: false, priority: 0, archived: false, created_at: new Date().toISOString() };
    all.push(todo);
    this._save(TODOS_KEY, all);
    return todo;
  },
  updateTodo(id, updates) {
    const all = this._load(TODOS_KEY);
    const t = all.find(x => x.id === id);
    if (t) Object.assign(t, updates);
    this._save(TODOS_KEY, all);
  },
  archiveTodo(id, archived) {
    this.updateTodo(id, { archived });
  },
  deleteTodo(id) {
    const all = this._load(TODOS_KEY).filter(x => x.id !== id);
    this._save(TODOS_KEY, all);
  },
  getCounts() {
    const all = this._load(TODOS_KEY);
    const brags = this._load(BRAGS_KEY);
    return {
      active: all.filter(t => !t.archived).length,
      archived: all.filter(t => t.archived).length,
      brags: brags.length,
    };
  },

  // Brags
  listBrags() {
    return this._load(BRAGS_KEY);
  },
  createBrag(todoId, text, summary) {
    const brags = this._load(BRAGS_KEY);
    const brag = { id: _nextId++, todo_id: todoId, text, summary, created_at: new Date().toISOString() };
    brags.push(brag);
    this._save(BRAGS_KEY, brags);
    this.archiveTodo(todoId, true);
    return brag;
  },
  deleteBrag(id) {
    const brags = this._load(BRAGS_KEY).filter(x => x.id !== id);
    this._save(BRAGS_KEY, brags);
  },
};

registerTab({
  id: 'tasks',
  title: 'Tasks',
  icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  lazy: true,
  init(ctx) {
    let todos = [];
    let brags = [];
    let showArchived = false;
    let showBrags = false;

    const PRIORITY_LABELS = ['none', 'low', 'medium', 'high'];

    // ── Build DOM ────────────────────────────────────
    const root = document.createElement('div');
    root.className = 'tasks-tab';
    root.style.cssText = 'display:flex;flex-direction:column;flex:1;overflow:hidden;';

    root.innerHTML = `
      <div class="todo-panel-header">
        <h3>Todo</h3>
        <div class="todo-header-actions">
          <button class="todo-brag-toggle todo-toggle-btn" title="Show brag list">${ICONS.starBrag}</button>
          <button class="todo-archive-toggle todo-toggle-btn" title="Show archived">${ICONS.archiveBig}</button>
          <button class="todo-add-btn" title="Add todo">+</button>
        </div>
      </div>
      <div class="todo-list"></div>
      <div class="todo-input-bar" style="display:none;">
        <input type="text" class="todo-input" placeholder="New todo..." autocomplete="off">
      </div>
    `;

    const todoList = root.querySelector('.todo-list');
    const todoAddBtn = root.querySelector('.todo-add-btn');
    const todoInputBar = root.querySelector('.todo-input-bar');
    const todoInput = root.querySelector('.todo-input');
    const archToggle = root.querySelector('.todo-archive-toggle');
    const bragToggle = root.querySelector('.todo-brag-toggle');
    const todoHeader = root.querySelector('.todo-panel-header h3');

    // ── Render ───────────────────────────────────────

    function renderTodos() {
      if (showBrags) {
        renderBrags();
        return;
      }

      if (!todos.length) {
        const isArchived = showArchived;
        todoList.innerHTML = `
          <div class="todo-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              ${isArchived
                ? '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>'
                : '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'}
            </svg>
            <span>${isArchived ? 'No archived todos' : 'No todos yet'}</span>
            ${!isArchived ? '<span class="todo-empty-hint">Click + to add one</span>' : ''}
          </div>`;
        return;
      }

      todoList.innerHTML = '';
      for (const t of todos) {
        const pri = t.priority || 0;
        const row = document.createElement('div');
        row.className = 'todo-item' + (t.done ? ' done' : '');
        if (pri > 0) row.classList.add(`priority-${pri}`);
        row.dataset.id = t.id;

        const priDot = document.createElement('button');
        priDot.className = `todo-priority-dot priority-${pri}`;
        priDot.title = `Priority: ${PRIORITY_LABELS[pri]} (click to change)`;
        priDot.addEventListener('click', () => handlePriority(t.id, (pri + 1) % 4));

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!t.done;
        cb.addEventListener('change', () => handleToggle(t.id, cb.checked ? 1 : 0));

        const span = document.createElement('span');
        span.className = 'todo-text';
        span.textContent = t.text;
        if (!showArchived) span.addEventListener('dblclick', () => startEdit(span, t));

        const actions = document.createElement('span');
        actions.className = 'todo-actions';

        if (!showArchived) {
          const bragBtn = document.createElement('button');
          bragBtn.className = 'todo-action-btn todo-brag-btn';
          bragBtn.title = 'Brag about this';
          bragBtn.innerHTML = ICONS.star;
          bragBtn.addEventListener('click', () => showBragPrompt(t));
          actions.appendChild(bragBtn);
        }

        const archBtn = document.createElement('button');
        archBtn.className = 'todo-action-btn todo-archive-btn';
        archBtn.title = showArchived ? 'Unarchive' : 'Archive';
        archBtn.innerHTML = showArchived ? ICONS.unarchive : ICONS.archive;
        archBtn.addEventListener('click', () => handleArchive(t.id, !showArchived));

        const delBtn = document.createElement('button');
        delBtn.className = 'todo-action-btn todo-delete-btn';
        delBtn.textContent = '\u00d7';
        delBtn.title = 'Delete';
        delBtn.addEventListener('click', () => handleDelete(t.id));

        actions.append(archBtn, delBtn);
        row.append(priDot, cb, span, actions);
        todoList.appendChild(row);
      }
    }

    function renderBrags() {
      if (!brags.length) {
        todoList.innerHTML = `
          <div class="todo-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span>No brags yet</span>
            <span class="todo-empty-hint">Complete a todo and brag about it</span>
          </div>`;
        return;
      }
      todoList.innerHTML = '';
      for (const b of brags) {
        const row = document.createElement('div');
        row.className = 'brag-item';

        const text = document.createElement('div');
        text.className = 'brag-text';
        text.textContent = b.text;

        const summary = document.createElement('div');
        summary.className = 'brag-summary';
        summary.textContent = b.summary;

        const date = document.createElement('div');
        date.className = 'brag-date';
        date.textContent = new Date(b.created_at).toLocaleDateString();

        const delBtn = document.createElement('button');
        delBtn.className = 'todo-action-btn todo-delete-btn brag-delete';
        delBtn.textContent = '\u00d7';
        delBtn.title = 'Delete';
        delBtn.addEventListener('click', () => {
          db.deleteBrag(b.id);
          brags = brags.filter(x => x.id !== b.id);
          renderTodos();
          refreshCounts();
        });

        row.append(text, summary, date, delBtn);
        todoList.appendChild(row);
      }
    }

    function updateHeaderToggle() {
      archToggle.classList.toggle('active', showArchived);
      archToggle.title = showArchived ? 'Show active todos' : 'Show archived';
      bragToggle.classList.toggle('active', showBrags);
      bragToggle.title = showBrags ? 'Show active todos' : 'Show brag list';
    }

    function refreshCounts() {
      const counts = db.getCounts();
      const label = showBrags ? 'Brags' : showArchived ? 'Archived' : 'Todo';
      const count = showBrags ? counts.brags : showArchived ? counts.archived : counts.active;
      todoHeader.textContent = `${label} (${count})`;
      setBadge(archToggle, counts.archived);
      setBadge(bragToggle, counts.brags);
    }

    function setBadge(btn, count) {
      let badge = btn.querySelector('.todo-count-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'todo-count-badge';
          btn.appendChild(badge);
        }
        badge.textContent = count;
      } else if (badge) {
        badge.remove();
      }
    }

    // ── CRUD handlers ────────────────────────────────
    function loadTodos() {
      todos = db.listTodos(showArchived);
      renderTodos();
      refreshCounts();
    }

    function handleToggle(id, done) {
      db.updateTodo(id, { done });
      const t = todos.find(x => x.id === id);
      if (t) t.done = done;
      renderTodos();
    }

    function handleArchive(id, archived) {
      db.archiveTodo(id, archived);
      todos = todos.filter(x => x.id !== id);
      renderTodos();
      refreshCounts();
    }

    function handlePriority(id, priority) {
      db.updateTodo(id, { priority });
      const t = todos.find(x => x.id === id);
      if (t) t.priority = priority;
      renderTodos();
    }

    function handleDelete(id) {
      db.deleteTodo(id);
      todos = todos.filter(x => x.id !== id);
      renderTodos();
      refreshCounts();
    }

    function showBragPrompt(todo) {
      const existing = document.querySelector('.brag-prompt-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.className = 'brag-prompt-overlay';
      overlay.innerHTML = `
        <div class="brag-prompt">
          <div class="brag-prompt-title">Brag about it!</div>
          <div class="brag-prompt-task">${escapeHtml(todo.text)}</div>
          <textarea class="brag-prompt-input" placeholder="Write a summary of what you accomplished..." maxlength="500" rows="4"></textarea>
          <div class="brag-prompt-counter"><span class="brag-char-count">0</span>/500</div>
          <div class="brag-prompt-actions">
            <button class="brag-prompt-cancel">Cancel</button>
            <button class="brag-prompt-submit">Brag it!</button>
          </div>
        </div>
      `;

      const textarea = overlay.querySelector('.brag-prompt-input');
      const counter = overlay.querySelector('.brag-char-count');
      const submitBtn = overlay.querySelector('.brag-prompt-submit');
      const cancelBtn = overlay.querySelector('.brag-prompt-cancel');

      textarea.addEventListener('input', () => { counter.textContent = textarea.value.length; });
      cancelBtn.addEventListener('click', () => overlay.remove());
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

      submitBtn.addEventListener('click', () => {
        const summary = textarea.value.trim();
        if (!summary) { textarea.focus(); return; }
        db.createBrag(todo.id, todo.text, summary);
        overlay.remove();
        todos = todos.filter(x => x.id !== todo.id);
        renderTodos();
        refreshCounts();
      });

      document.body.appendChild(overlay);
      textarea.focus();
    }

    function startEdit(span, todo) {
      span.contentEditable = 'true';
      span.classList.add('editing');
      span.focus();

      const range = document.createRange();
      range.selectNodeContents(span);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      const finish = () => {
        span.contentEditable = 'false';
        span.classList.remove('editing');
        const newText = span.textContent.trim();
        if (newText && newText !== todo.text) {
          db.updateTodo(todo.id, { text: newText });
          todo.text = newText;
        } else {
          span.textContent = todo.text;
        }
      };

      span.addEventListener('blur', finish, { once: true });
      span.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); span.blur(); }
        if (e.key === 'Escape') { span.textContent = todo.text; span.blur(); }
      });
    }

    // ── Event listeners ──────────────────────────────
    todoAddBtn.addEventListener('click', () => {
      todoInputBar.style.display = '';
      todoInput.value = '';
      todoInput.focus();
    });

    todoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = todoInput.value.trim();
        if (!text) return;
        todoInput.value = '';
        todoInputBar.style.display = 'none';
        db.createTodo(text);
        loadTodos();
      }
      if (e.key === 'Escape') {
        todoInputBar.style.display = 'none';
      }
    });

    archToggle.addEventListener('click', () => {
      showArchived = !showArchived;
      showBrags = false;
      updateHeaderToggle();
      todoAddBtn.style.display = showArchived ? 'none' : '';
      todoInputBar.style.display = 'none';
      loadTodos();
    });

    bragToggle.addEventListener('click', () => {
      showBrags = !showBrags;
      showArchived = false;
      updateHeaderToggle();
      todoAddBtn.style.display = showBrags ? 'none' : '';
      todoInputBar.style.display = 'none';
      if (showBrags) {
        brags = db.listBrags();
        renderTodos();
        refreshCounts();
      } else {
        loadTodos();
      }
    });

    // Initial load
    loadTodos();

    return root;
  },

  onActivate() {
    // no-op: todos load on init
  },
});
