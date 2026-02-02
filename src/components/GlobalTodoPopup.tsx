import { useState, useCallback, useEffect, useRef } from 'react';
import type { Note } from '../types';

interface GlobalTodoPopupProps {
  isOpen: boolean;
  onClose: () => void;
  todos: Note[];
  onCreateTodo: (content: string) => Promise<Note>;
  onToggleTodo: (noteId: string) => Promise<void>;
  onUpdateTodo: (noteId: string, updates: Partial<Note>) => Promise<void>;
  onDeleteTodo: (noteId: string) => Promise<void>;
}

export function GlobalTodoPopup({
  isOpen,
  onClose,
  todos,
  onCreateTodo,
  onToggleTodo,
  onUpdateTodo,
  onDeleteTodo,
}: GlobalTodoPopupProps) {
  const [newTodoText, setNewTodoText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1); // -1 means input is focused
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Sort todos: incomplete first, then by creation date (newest first)
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return b.createdAt - a.createdAt;
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setNewTodoText('');
      setSelectedIndex(-1);
      setEditingId(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Focus edit input when editing
  useEffect(() => {
    if (editingId) {
      setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 0);
    }
  }, [editingId]);

  // Focus list when selectedIndex changes from -1 to a valid index
  useEffect(() => {
    if (selectedIndex >= 0) {
      listRef.current?.focus();
    }
  }, [selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.global-todo-item');
      const selectedItem = items[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle escape at document level to close popup
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (editingId) {
          setEditingId(null);
          setEditingText('');
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [isOpen, onClose, editingId]);

  const handleAddTodo = useCallback(async () => {
    const text = newTodoText.trim();
    if (!text) return;

    await onCreateTodo(text);
    setNewTodoText('');
    inputRef.current?.focus();
  }, [newTodoText, onCreateTodo]);

  const handleStartEdit = useCallback((todo: Note) => {
    setEditingId(todo.id);
    setEditingText(todo.content);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    const text = editingText.trim();
    if (text) {
      await onUpdateTodo(editingId, { content: text });
    }
    setEditingId(null);
    setEditingText('');
  }, [editingId, editingText, onUpdateTodo]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTodo();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (sortedTodos.length > 0) {
        setSelectedIndex(0);
      }
    }
  }, [handleAddTodo, sortedTodos.length]);

  const handleListKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editingId) return; // Don't handle navigation while editing

    const todo = sortedTodos[selectedIndex];

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selectedIndex <= 0) {
        setSelectedIndex(-1);
        inputRef.current?.focus();
      } else {
        setSelectedIndex(selectedIndex - 1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (selectedIndex < sortedTodos.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      }
    } else if (e.key === ' ' && todo) {
      e.preventDefault();
      onToggleTodo(todo.id);
    } else if (e.key === 'Enter' && todo) {
      e.preventDefault();
      handleStartEdit(todo);
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && todo) {
      e.preventDefault();
      onDeleteTodo(todo.id);
      // Adjust selection if needed
      if (selectedIndex >= sortedTodos.length - 1) {
        setSelectedIndex(Math.max(-1, sortedTodos.length - 2));
      }
    }
  }, [editingId, selectedIndex, sortedTodos, onToggleTodo, onDeleteTodo, handleStartEdit]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setEditingId(null);
      setEditingText('');
    }
  }, [handleSaveEdit]);

  if (!isOpen) return null;

  const incompleteTodos = sortedTodos.filter(t => !t.completed);
  const completedTodos = sortedTodos.filter(t => t.completed);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal global-todo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="global-todo-header">
          <input
            ref={inputRef}
            type="text"
            className="global-todo-input"
            placeholder="Add a new todo..."
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onFocus={() => setSelectedIndex(-1)}
          />
        </div>

        <div
          ref={listRef}
          className="global-todo-list"
          tabIndex={0}
          onKeyDown={handleListKeyDown}
        >
          {sortedTodos.length === 0 ? (
            <div className="global-todo-empty">
              No todos yet. Type above to add one.
            </div>
          ) : (
            <>
              {incompleteTodos.length > 0 && (
                <div className="global-todo-section">
                  {incompleteTodos.map((todo, idx) => {
                    const isSelected = selectedIndex === idx;
                    const isEditing = editingId === todo.id;

                    return (
                      <div
                        key={todo.id}
                        className={`global-todo-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedIndex(idx);
                          listRef.current?.focus();
                        }}
                        onDoubleClick={() => handleStartEdit(todo)}
                      >
                        <span
                          className="todo-checkbox"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTodo(todo.id);
                          }}
                        >
                          ☐
                        </span>
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            className="global-todo-edit-input"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            onBlur={handleSaveEdit}
                          />
                        ) : (
                          <span className="global-todo-text">{todo.content}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {completedTodos.length > 0 && (
                <div className="global-todo-section">
                  <div className="global-todo-section-header">
                    Completed ({completedTodos.length})
                  </div>
                  {completedTodos.map((todo, idx) => {
                    const actualIndex = incompleteTodos.length + idx;
                    const isSelected = selectedIndex === actualIndex;
                    const isEditing = editingId === todo.id;

                    return (
                      <div
                        key={todo.id}
                        className={`global-todo-item completed ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedIndex(actualIndex);
                          listRef.current?.focus();
                        }}
                        onDoubleClick={() => handleStartEdit(todo)}
                      >
                        <span
                          className="todo-checkbox checked"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTodo(todo.id);
                          }}
                        >
                          ☑
                        </span>
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            className="global-todo-edit-input"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            onBlur={handleSaveEdit}
                          />
                        ) : (
                          <span className="global-todo-text">{todo.content}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-hint">
          <div className="shortcut-item">
            <div className="shortcut-keys"><kbd>↑</kbd><kbd>↓</kbd></div>
            <span className="shortcut-desc">navigate</span>
          </div>
          <div className="shortcut-item">
            <div className="shortcut-keys"><kbd>Space</kbd></div>
            <span className="shortcut-desc">toggle</span>
          </div>
          <div className="shortcut-item">
            <div className="shortcut-keys"><kbd>Enter</kbd></div>
            <span className="shortcut-desc">edit</span>
          </div>
          <div className="shortcut-item">
            <div className="shortcut-keys"><kbd>Del</kbd></div>
            <span className="shortcut-desc">delete</span>
          </div>
          <div className="shortcut-item">
            <div className="shortcut-keys"><kbd>Esc</kbd></div>
            <span className="shortcut-desc">close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
