import { StateManager } from 'src/StateManager';
import { KanbanView } from 'src/KanbanView';
import { getBoardModifiers } from 'src/helpers/boardModifiers';
import { Board, Item } from './types';
import { handleAdHocMoveFromPath } from './Item/ItemMenu';
import { CalendarSuggestModal, CalendarSource } from './FileSuggest/FileSuggestModal';
import { KeyboardHelpModal } from './KeyboardHelpModal';
import { createCalendarEvent, getFullCalendarDataSync } from './Item/helpers';
import update from 'immutability-helper';

interface FocusedCard {
  laneIndex: number;
  cardIndex: number;
  cardId: string;
}

export class KeyboardNavigationManager {
  private focusedCard: FocusedCard | null = null;
  private stateManager: StateManager;
  private view: KanbanView;
  private rootElement: HTMLElement;
  private isMoving: boolean = false;

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
      const firstLane = board.children[0];
      if (firstLane && firstLane.children && firstLane.children.length > 0) {
        const firstCard = firstLane.children[0] as Item;
        this.focusedCard = { laneIndex: 0, cardIndex: 0, cardId: firstCard.id };
        this.updateVisualFocus();
      }
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
      case 'c':
        e.preventDefault();
        this.copyToCalendar(board);
        break;
      case '?':
        e.preventDefault();
        this.showHelp();
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
      const newIndex = this.focusedCard.cardIndex - 1;
      const newCard = lane.children[newIndex] as Item;
      this.focusedCard = {
        laneIndex: this.focusedCard.laneIndex,
        cardIndex: newIndex,
        cardId: newCard.id
      };
      this.updateVisualFocus();
    }
  }

  private moveFocusDown(board: Board) {
    if (!this.focusedCard) return;

    const lane = board.children[this.focusedCard.laneIndex];
    if (!lane || !lane.children) return;

    if (this.focusedCard.cardIndex < lane.children.length - 1) {
      const newIndex = this.focusedCard.cardIndex + 1;
      const newCard = lane.children[newIndex] as Item;
      this.focusedCard = {
        laneIndex: this.focusedCard.laneIndex,
        cardIndex: newIndex,
        cardId: newCard.id
      };
      this.updateVisualFocus();
    }
  }

  private moveFocusLeft(board: Board) {
    if (!this.focusedCard) return;

    if (this.focusedCard.laneIndex > 0) {
      const newLaneIndex = this.focusedCard.laneIndex - 1;
      // Clamp card index to new lane's length
      const newLane = board.children[newLaneIndex];
      if (newLane && newLane.children && newLane.children.length > 0) {
        const newCardIndex = Math.min(
          this.focusedCard.cardIndex,
          newLane.children.length - 1
        );
        const newCard = newLane.children[newCardIndex] as Item;
        this.focusedCard = {
          laneIndex: newLaneIndex,
          cardIndex: newCardIndex,
          cardId: newCard.id
        };
      }
      this.updateVisualFocus();
    }
  }

  private moveFocusRight(board: Board) {
    if (!this.focusedCard) return;

    if (this.focusedCard.laneIndex < board.children.length - 1) {
      const newLaneIndex = this.focusedCard.laneIndex + 1;
      // Clamp card index to new lane's length
      const newLane = board.children[newLaneIndex];
      if (newLane && newLane.children && newLane.children.length > 0) {
        const newCardIndex = Math.min(
          this.focusedCard.cardIndex,
          newLane.children.length - 1
        );
        const newCard = newLane.children[newCardIndex] as Item;
        this.focusedCard = {
          laneIndex: newLaneIndex,
          cardIndex: newCardIndex,
          cardId: newCard.id
        };
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
        const newIndex = Math.min(currentIndex, originalLength - 1);
        const updatedBoard = this.stateManager.state;
        if (updatedBoard && updatedBoard.children[laneIndex] && updatedBoard.children[laneIndex].children) {
          const cardAtPos = updatedBoard.children[laneIndex].children[newIndex] as Item;
          if (cardAtPos) {
            this.focusedCard = { laneIndex, cardIndex: newIndex, cardId: cardAtPos.id };
            this.updateVisualFocus();
          }
        }
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
      const cardAtPos = updatedLane.children[newIndex] as Item;
      if (cardAtPos) {
        this.focusedCard = { laneIndex, cardIndex: newIndex, cardId: cardAtPos.id };
        this.updateVisualFocus();
      }
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
      const cardAtPos = updatedLane.children[newIndex] as Item;
      if (cardAtPos) {
        this.focusedCard = { laneIndex, cardIndex: newIndex, cardId: cardAtPos.id };
        this.updateVisualFocus();
      }
    };

    setTimeout(() => attemptRefocus(), 50);
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
    if (this.isMoving) return; // Prevent concurrent moves

    const movedCardId = this.focusedCard.cardId;

    // Trust focusedCard position - don't search the state which might be stale
    const laneIndex = this.focusedCard.laneIndex;
    const cardIndex = this.focusedCard.cardIndex;

    if (cardIndex === 0) return; // Already at top

    // Set lock
    this.isMoving = true;

    this.stateManager.setState((boardData) => {
      // Read cards from boardData, not from this.stateManager.state
      const lane = boardData.children[laneIndex];
      if (!lane || !lane.children) return boardData;
      if (cardIndex === 0) return boardData; // Already at top
      if (cardIndex >= lane.children.length) return boardData;

      const currentCard = lane.children[cardIndex];
      const cardAbove = lane.children[cardIndex - 1];

      return update(boardData, {
        children: {
          [laneIndex]: {
            children: {
              [cardIndex - 1]: { $set: currentCard },
              [cardIndex]: { $set: cardAbove },
            },
          },
        },
      });
    });

    // Wait for DOM to update
    setTimeout(() => {
      // Update to new position
      const newIndex = cardIndex - 1;
      this.focusedCard = { laneIndex: laneIndex, cardIndex: newIndex, cardId: movedCardId };
      this.updateVisualFocus();
      this.isMoving = false;
    }, 50);
  }

  private moveCardDown(board: Board) {
    if (!this.focusedCard) return;
    if (this.isMoving) return; // Prevent concurrent moves

    const movedCardId = this.focusedCard.cardId;

    // Trust focusedCard position - don't search the state which might be stale
    const laneIndex = this.focusedCard.laneIndex;
    const cardIndex = this.focusedCard.cardIndex;

    // Set lock
    this.isMoving = true;

    this.stateManager.setState((boardData) => {
      // Read cards from boardData, not from this.stateManager.state
      const lane = boardData.children[laneIndex];
      if (!lane || !lane.children) return boardData;
      if (cardIndex >= lane.children.length - 1) return boardData; // Already at bottom

      const currentCard = lane.children[cardIndex];
      const cardBelow = lane.children[cardIndex + 1];

      return update(boardData, {
        children: {
          [laneIndex]: {
            children: {
              [cardIndex]: { $set: cardBelow },
              [cardIndex + 1]: { $set: currentCard },
            },
          },
        },
      });
    });

    // Wait for DOM to update
    setTimeout(() => {
      // Update to new position
      const newIndex = cardIndex + 1;
      this.focusedCard = { laneIndex: laneIndex, cardIndex: newIndex, cardId: movedCardId };
      this.updateVisualFocus();
      this.isMoving = false;
    }, 50);
  }

  private updateVisualFocus() {
    // Remove existing focus
    const existing = this.rootElement.querySelector('.kanban-plugin__item--keyboard-focused');
    if (existing) {
      existing.classList.remove('kanban-plugin__item--keyboard-focused');
    }

    if (!this.focusedCard) return;

    // Use focusedCard.cardId directly - don't read from state which might be stale
    const cardElement = this.findCardElement(this.focusedCard.cardId);
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
    if (!this.focusedCard) return null;

    // Trust that focusedCard is already correct from the ID-based search in move functions
    // Just do a simple position-based lookup
    const lanes = this.rootElement.querySelectorAll('.kanban-plugin__lane');
    if (lanes[this.focusedCard.laneIndex]) {
      const lane = lanes[this.focusedCard.laneIndex];
      const cards = lane.querySelectorAll('.kanban-plugin__item');
      if (cards[this.focusedCard.cardIndex]) {
        return cards[this.focusedCard.cardIndex] as HTMLElement;
      }
    }

    return null;
  }

  private copyToCalendar(board: Board) {
    if (!this.focusedCard) return;

    // Check if copy to calendar is enabled
    const copyToCalendarEnabled = this.stateManager.getSetting('enable-copy-to-calendar');
    if (!copyToCalendarEnabled) {
      return;
    }

    const lane = board.children[this.focusedCard.laneIndex];
    if (!lane || !lane.children) return;

    const card = lane.children[this.focusedCard.cardIndex] as Item;
    if (!card) return;

    // Get available calendars
    const calendars = getFullCalendarDataSync(this.stateManager);
    if (calendars.length === 0) {
      return;
    }

    const path = [this.focusedCard.laneIndex, this.focusedCard.cardIndex];
    const boardModifiers = getBoardModifiers(this.view, this.stateManager);

    // Show calendar picker
    const calendarPicker = new CalendarSuggestModal(
      this.stateManager.app,
      calendars,
      async (calendar: CalendarSource) => {
        await createCalendarEvent(this.stateManager, card, calendar, path, boardModifiers);
      }
    );
    calendarPicker.open();
  }

  private showHelp() {
    const helpModal = new KeyboardHelpModal(this.stateManager.app);
    helpModal.open();
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
