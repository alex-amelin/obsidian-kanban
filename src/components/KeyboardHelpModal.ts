import { Modal, App } from 'obsidian';

export class KeyboardHelpModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('kanban-plugin__keyboard-help-modal');

    contentEl.createEl('h2', { text: 'Keyboard Shortcuts' });

    const shortcuts = [
      { keys: '↑ ↓ ← →', description: 'Navigate between cards' },
      { keys: 'j', description: 'Move card down' },
      { keys: 'k', description: 'Move card up' },
      { keys: 'a', description: 'Add new card in focused lane' },
      { keys: 'c', description: 'Copy card to calendar' },
      { keys: 'f', description: 'Move card to another file' },
      { keys: 'd', description: 'Delete focused card' },
      { keys: 'Enter', description: 'Edit focused card' },
      { keys: 'Esc', description: 'Clear focus' },
      { keys: '?', description: 'Show this help' },
    ];

    const table = contentEl.createEl('table', { cls: 'kanban-plugin__keyboard-help-table' });

    shortcuts.forEach((shortcut) => {
      const row = table.createEl('tr');
      const keyCell = row.createEl('td', { cls: 'kanban-plugin__keyboard-help-key' });
      keyCell.createEl('kbd', { text: shortcut.keys });
      row.createEl('td', { text: shortcut.description });
    });

    // Add some basic styling
    const style = contentEl.createEl('style');
    style.textContent = `
      .kanban-plugin__keyboard-help-modal {
        padding: 20px;
      }
      .kanban-plugin__keyboard-help-table {
        width: 100%;
        margin-top: 20px;
      }
      .kanban-plugin__keyboard-help-table tr {
        border-bottom: 1px solid var(--background-modifier-border);
      }
      .kanban-plugin__keyboard-help-table td {
        padding: 10px;
      }
      .kanban-plugin__keyboard-help-key {
        width: 120px;
        font-weight: bold;
      }
      .kanban-plugin__keyboard-help-key kbd {
        display: inline-block;
        padding: 3px 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-secondary);
        font-family: monospace;
      }
    `;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
