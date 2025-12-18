import { StateManager } from 'src/StateManager';
import { KanbanView } from 'src/KanbanView';
import { getBoardModifiers } from 'src/helpers/boardModifiers';
import { Board, Item } from './types';
import { handleAdHocMoveFromPath } from './Item/ItemMenu';

interface FocusedCard {
  laneIndex: number;
  cardIndex: number;
}

export class KeyboardNavigationManager {
  private focusedCard: FocusedCard | null = null;
  private stateManager: StateManager;
  private view: KanbanView;
  private rootElement: HTMLElement;

  constructor(stateManager: StateManager, view: KanbanView, rootElement: HTMLElement) {
    this.stateManager = stateManager;
    this.view = view;
    this.rootElement = rootElement;
  }

  handleKeyDown = (e: KeyboardEvent) => {
    // Don't intercept if user is typing in an input or textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Only handle keyboard events if this kanban view is in the active leaf
    const activeLeaf = this.view.app.workspace.activeLeaf;
    if (!activeLeaf || activeLeaf.view !== this.view) {
      return;
    }

    const board = this.stateManager.state;
    if (!board || !board.children || board.children.length === 0) {
      return;
    }

    // Initialize focus if not set
    if (!this.focusedCard) {
      this.focusedCard = { laneIndex: 0, cardIndex: 0 };
      this.updateVisualFocus();
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.moveFocusUp(board);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.moveFocusDown(board);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.moveFocusLeft(board);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.moveFocusRight(board);
        break;
      case 'f':
        e.preventDefault();
        this.executeAdHocMove(board);
        break;
      case 'd':
        e.preventDefault();
        this.deleteCard(board);
        break;
      case '>':
        e.preventDefault();
        this.showMenu(board);
        break;
      case 'Enter':
        e.preventDefault();
        this.editCard(board);
        break;
      case 'a':
        e.preventDefault();
        this.addCard(board);
        break;
      case 'j':
        e.preventDefault();
        this.moveCardDown(board);
        break;
      case 'k':
        e.preventDefault();
        this.moveCardUp(board);
        break;
      case 'Escape':
        e.preventDefault();
        this.clearFocus();
        break;
    }
  };

  private moveFocusUp(board: Board) {
    if (!this.focusedCard) return;

    const lane = board.children[this.focusedCard.laneIndex];
    if (!lane || !lane.children) return;

    if (this.focusedCard.cardIndex > 0) {
      this.focusedCard.cardIndex--;
      this.updateVisualFocus();
    }
  }

  private moveFocusDown(board: Board) {
    if (!this.focusedCard) return;

    const lane = board.children[this.focusedCard.laneIndex];
    if (!lane || !lane.children) return;

    if (this.focusedCard.cardIndex < lane.children.length - 1) {
      this.focusedCard.cardIndex++;
      this.updateVisualFocus();
    }
  }

  private moveFocusLeft(board: Board) {
    if (!this.focusedCard) return;

    if (this.focusedCard.laneIndex > 0) {
      this.focusedCard.laneIndex--;
      // Clamp card index to new lane's length
      const newLane = board.children[this.focusedCard.laneIndex];
      if (newLane && newLane.children) {
        this.focusedCard.cardIndex = Math.min(
          this.focusedCard.cardIndex,
          newLane.children.length - 1
        );
      }
      this.updateVisualFocus();
    }
  }

  private moveFocusRight(board: Board) {
    if (!this.focusedCard) return;

    if (this.focusedCard.laneIndex < board.children.length - 1) {
      this.focusedCard.laneIndex++;
      // Clamp card index to new lane's length
      const newLane = board.children[this.focusedCard.laneIndex];
      if (newLane && newLane.children) {
        this.focusedCard.cardIndex = Math.min(
          this.focusedCard.cardIndex,
          newLane.children.length - 1
        );
      }
      this.updateVisualFocus();
    }
  }

  private executeAdHocMove(board: Board) {
    if (!this.focusedCard) return;

    const lane = board.children[this.focusedCard.laneIndex];
    if (!lane || !lane.children) return;

    const card = lane.children[this.focusedCard.cardIndex] as Item;
    if (!card) return;

    // Capture focus position BEFORE move (since focusedCard may be cleared)
    const currentIndex = this.focusedCard.cardIndex;
    const laneIndex = this.focusedCard.laneIndex;
    const originalLength = lane.children.length;
    const path = [laneIndex, currentIndex];

    // Execute the move (async operation with user interaction)
    handleAdHocMoveFromPath(this.stateManager, card, path);

    // After move completes, focus on the next card in the list
    // The move operation involves modals and user interaction, so we need to wait longer
    // Cross-file moves can take 5+ seconds, so we need generous timeout
    const attemptRefocus = (attempt = 0) => {
      if (attempt > 40) {
        // If we gave up, restore focus to the original card (user likely cancelled)
        this.focusedCard = { laneIndex, cardIndex: Math.min(currentIndex, originalLength - 1) };
        this.updateVisualFocus();
        return;
      }

      const updatedBoard = this.stateManager.state;
      if (!updatedBoard) {
        return;
      }

      const updatedLane = updatedBoard.children[laneIndex];
      if (!updatedLane || !updatedLane.children) {
        return;
      }

      const currentLength = updatedLane.children.length;

      // If the lane hasn't been updated yet, try again
      if (currentLength === originalLength) {
        setTimeout(() => attemptRefocus(attempt + 1), 200);
        return;
      }

      if (currentLength === 0) {
        this.clearFocus();
        return;
      }

      // Restore focus to the next card
      const newIndex = Math.min(currentIndex, currentLength - 1);
      this.focusedCard = { laneIndex, cardIndex: newIndex };
      this.updateVisualFocus();
    };

    // Start checking after 500ms to give user time to interact with modal
    setTimeout(() => attemptRefocus(), 500);
  }

  private deleteCard(board: Board) {
    if (!this.focusedCard) return;

    const lane = board.children[this.focusedCard.laneIndex];
    if (!lane || !lane.children) return;

    // Capture focus position BEFORE deletion (since focusedCard may be cleared)
    const currentIndex = this.focusedCard.cardIndex;
    const laneIndex = this.focusedCard.laneIndex;
    const originalLength = lane.children.length;
    const path = [laneIndex, currentIndex];
    const boardModifiers = getBoardModifiers(this.view, this.stateManager);

    boardModifiers.deleteEntity(path);

    // After deletion, focus on the next card (or previous if we deleted the last one)
    // Wait for state update with multiple retries
    const attemptRefocus = (attempt = 0) => {
      if (attempt > 10) {
        return;
      }

      const updatedBoard = this.stateManager.state;
      if (!updatedBoard) {
        return;
      }

      const updatedLane = updatedBoard.children[laneIndex];
      if (!updatedLane || !updatedLane.children) {
        return;
      }

      // If the lane hasn't been updated yet, try again
      if (updatedLane.children.length === originalLength) {
        setTimeout(() => attemptRefocus(attempt + 1), 50);
        return;
      }

      if (updatedLane.children.length === 0) {
        this.clearFocus();
        return;
      }

      // Restore focus to the next card
      const newIndex = Math.min(currentIndex, updatedLane.children.length - 1);
      this.focusedCard = { laneIndex, cardIndex: newIndex };
      this.updateVisualFocus();
    };

    setTimeout(() => attemptRefocus(), 50);
  }

  private showMenu(board: Board) {
    if (!this.focusedCard) return;

    const lane = board.children[this.focusedCard.laneIndex];
    if (!lane || !lane.children) return;

    const card = lane.children[this.focusedCard.cardIndex] as Item;
    if (!card) return;

    // Find the card element and trigger context menu
    const cardElement = this.findCardElement(card.id);
    if (cardElement) {
      const rect = cardElement.getBoundingClientRect();
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      });
      cardElement.dispatchEvent(event);
    }
  }

  private editCard(board: Board) {
    if (!this.focusedCard) return;

    const lane = board.children[this.focusedCard.laneIndex];
    if (!lane || !lane.children) return;

    const card = lane.children[this.focusedCard.cardIndex] as Item;
    if (!card) return;

    // Find the card element and trigger double-click to enter edit mode
    const cardElement = this.findCardElement(card.id);
    if (cardElement) {
      // The dblclick handler is on the .kanban-plugin__item-content-wrapper element
      const contentWrapper = cardElement.querySelector('.kanban-plugin__item-content-wrapper');
      if (contentWrapper) {
        const rect = contentWrapper.getBoundingClientRect();
        const event = new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        });
        contentWrapper.dispatchEvent(event);
      }
    }
  }

  private addCard(board: Board) {
    if (!this.focusedCard) return;

    // Find the "Add a card" button in the focused lane and click it
    const lanes = this.rootElement.querySelectorAll('.kanban-plugin__lane');
    if (lanes[this.focusedCard.laneIndex]) {
      const lane = lanes[this.focusedCard.laneIndex];
      const addButton = lane.querySelector('.kanban-plugin__new-item-button') as HTMLElement;
      if (addButton) {
        addButton.click();
      }
    }
  }

  private moveCardUp(board: Board) {
    if (!this.focusedCard) return;

    const lane = board.children[this.focusedCard.laneIndex];
    if (!lane || !lane.children) return;

    const cardIndex = this.focusedCard.cardIndex;
    if (cardIndex === 0) return; // Already at top

    const laneIndex = this.focusedCard.laneIndex;
    const fromPath = [laneIndex, cardIndex];
    const toPath = [laneIndex, cardIndex - 1];

    const boardModifiers = getBoardModifiers(this.view, this.stateManager);

    // Move the card up
    this.stateManager.setState((boardData) => {
      const { moveEntity } = require('src/dnd/util/data');
      return moveEntity(boardData, fromPath, toPath);
    });

    // Update focus to follow the card
    this.focusedCard.cardIndex = cardIndex - 1;
    setTimeout(() => this.updateVisualFocus(), 50);
  }

  private moveCardDown(board: Board) {
    if (!this.focusedCard) return;

    const lane = board.children[this.focusedCard.laneIndex];
    if (!lane || !lane.children) return;

    const cardIndex = this.focusedCard.cardIndex;
    if (cardIndex >= lane.children.length - 1) return; // Already at bottom

    const laneIndex = this.focusedCard.laneIndex;
    const fromPath = [laneIndex, cardIndex];
    const toPath = [laneIndex, cardIndex + 1];

    const boardModifiers = getBoardModifiers(this.view, this.stateManager);

    // Move the card down
    this.stateManager.setState((boardData) => {
      const { moveEntity } = require('src/dnd/util/data');
      return moveEntity(boardData, fromPath, toPath);
    });

    // Update focus to follow the card
    this.focusedCard.cardIndex = cardIndex + 1;
    setTimeout(() => this.updateVisualFocus(), 50);
  }

  private updateVisualFocus() {
    // Remove existing focus
    const existing = this.rootElement.querySelector('.kanban-plugin__item--keyboard-focused');
    if (existing) {
      existing.classList.remove('kanban-plugin__item--keyboard-focused');
    }

    if (!this.focusedCard) return;

    const board = this.stateManager.state;
    if (!board || !board.children) return;

    const lane = board.children[this.focusedCard.laneIndex];
    if (!lane || !lane.children) return;

    const card = lane.children[this.focusedCard.cardIndex] as Item;
    if (!card) return;

    const cardElement = this.findCardElement(card.id);
    if (cardElement) {
      cardElement.classList.add('kanban-plugin__item--keyboard-focused');

      // Scroll into view if needed
      cardElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }

  private findCardElement(cardId: string): HTMLElement | null {
    // Find card by data attribute or by searching through items
    const items = this.rootElement.querySelectorAll('.kanban-plugin__item');
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as HTMLElement;
      // The card ID is part of the drag-drop system, we'll need to find it by position
      // For now, we'll use a simpler approach
    }

    // Alternative: find by position
    const lanes = this.rootElement.querySelectorAll('.kanban-plugin__lane');
    if (this.focusedCard && lanes[this.focusedCard.laneIndex]) {
      const lane = lanes[this.focusedCard.laneIndex];
      const cards = lane.querySelectorAll('.kanban-plugin__item');
      if (cards[this.focusedCard.cardIndex]) {
        return cards[this.focusedCard.cardIndex] as HTMLElement;
      }
    }

    return null;
  }

  private clearFocus() {
    const existing = this.rootElement.querySelector('.kanban-plugin__item--keyboard-focused');
    if (existing) {
      existing.classList.remove('kanban-plugin__item--keyboard-focused');
    }
    this.focusedCard = null;
  }

  public destroy() {
    this.clearFocus();
  }
}
