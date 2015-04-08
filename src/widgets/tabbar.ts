/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015, S. Chris Colbert
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
module phosphor.widgets {

import IMessage = core.IMessage;
import Signal = core.Signal;

import IDisposable = utility.IDisposable;
import Pair = utility.Pair;
import Size = utility.Size;
import hitTest = utility.hitTest;
import overrideCursor = utility.overrideCursor;


/**
 * The class name added to TabBar instances.
 */
var TAB_BAR_CLASS = 'p-TabBar';

/**
 * The class name added to the tab bar header div.
 */
var HEADER_CLASS = 'p-TabBar-header';

/**
 * The class name added to the tab bar content list.
 */
var CONTENT_CLASS = 'p-TabBar-content';

/**
 * The class name added to the tab bar footer div.
 */
var FOOTER_CLASS = 'p-TabBar-footer';

/**
 * The class name added to the content div when transitioning tabs.
 */
var TRANSITION_CLASS = 'p-mod-transition';

/**
 * The class name added to a tab being inserted.
 */
var INSERTING_CLASS = 'p-mod-inserting';

/**
 * The class name added to a tab being removed.
 */
var REMOVING_CLASS = 'p-mod-removing';

/**
 * The overlap threshold before swapping tabs.
 */
var OVERLAP_THRESHOLD = 0.6;

/**
 * The start drag distance threshold.
 */
var DRAG_THRESHOLD = 5;

/**
 * The detach distance threshold.
 */
var DETACH_THRESHOLD = 20;

/**
 * The tab transition duration.
 */
var TRANSITION_DURATION = 150;

/**
 * The size of a collapsed tab stub.
 */
var TAB_STUB_SIZE = 7;


/**
 * The arguments object for the `tabDetachRequested` signal.
 */
export
interface ITabDetachArgs {
  /**
   * The tab of interest.
   */
  tab: ITab;

  /**
   * The index of the tab.
   */
  index: number;

  /**
   * The current mouse client X position.
   */
  clientX: number;

  /**
   * The current mouse client Y position.
   */
  clientY: number;
}


/**
 * A leaf widget which displays a row of tabs.
 */
export
class TabBar extends Widget {
  /**
   * A signal emitted when a tab is moved.
   */
  tabMoved = new Signal<TabBar, Pair<number, number>>();

  /**
   * A signal emitted when the currently selected tab is changed.
   */
  currentChanged = new Signal<TabBar, Pair<number, ITab>>();

  /**
   * A signal emitted when the user clicks a tab close icon.
   */
  tabCloseRequested = new Signal<TabBar, Pair<number, ITab>>();

  /**
   * A signal emitted when a tab is dragged beyond the detach threshold.
   */
  tabDetachRequested = new Signal<TabBar, ITabDetachArgs>();

  /**
   * Construct a new tab bar.
   */
  constructor() {
    super();
    this.addClass(TAB_BAR_CLASS);
    this.verticalSizePolicy = SizePolicy.Fixed;
  }

  /*
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this._releaseMouse();
    this.tabMoved.disconnect();
    this.currentChanged.disconnect();
    this.tabCloseRequested.disconnect();
    this.tabDetachRequested.disconnect();
    this._tabs = null;
    super.dispose();
  }

  /**
   * Get the currently selected tab index.
   */
  get currentIndex(): number {
    return this._tabs.indexOf(this._currentTab);
  }

  /**
   * Set the currently selected tab index.
   */
  set currentIndex(index: number) {
    var prev = this._currentTab;
    var next = this._tabs[index] || null;
    if (prev === next) {
      return;
    }
    if (prev) prev.selected = false;
    if (next) next.selected = true;
    this._currentTab = next;
    this._previousTab = prev;
    this._refreshTabZOrder();
    this.currentChanged.emit(this, new Pair(next ? index : -1, next));
  }

  /**
   * Get the currently selected tab.
   */
  get currentTab(): ITab {
    return this._currentTab;
  }

  /**
   * Set the currently selected tab.
   */
  set currentTab(tab: ITab) {
    this.currentIndex = this._tabs.indexOf(tab);
  }

  /**
   * Get the previously selected tab.
   */
  get previousTab(): ITab {
    return this._previousTab;
  }

  /**
   * Get whether the tabs are movable by the user.
   */
  get tabsMovable(): boolean {
    return this._movable;
  }

  /**
   * Set whether the tabs are movable by the user.
   */
  set tabsMovable(movable: boolean) {
    this._movable = movable;
    if (!movable) this._releaseMouse();
  }

  /**
   * Get the preferred tab width.
   *
   * Tabs will be sized to this width if possible, but never larger.
   */
  get tabWidth(): number {
    return this._tabWidth;
  }

  /**
   * Set the preferred tab width.
   *
   * Tabs will be sized to this width if possible, but never larger.
   */
  set tabWidth(width: number) {
    width = Math.max(0, width);
    if (width === this._tabWidth) {
      return;
    }
    this._tabWidth = width;
    if (this.isAttached) {
      this._updateTabLayout();
      this.updateGeometry();
    }
  }

  /**
   * Get the minimum tab width.
   *
   * Tabs will never be sized smaller than this amount.
   */
  get minTabWidth(): number {
    return this._minTabWidth;
  }

  /**
   * Set the minimum tab width in pixels.
   *
   * Tabs will never be sized smaller than this amount.
   */
  set minTabWidth(width: number) {
    width = Math.max(0, width);
    if (width === this._minTabWidth) {
      return;
    }
    this._minTabWidth = width;
    if (this.isAttached) {
      this._updateTabLayout();
      this.updateGeometry();
    }
  }

  /**
   * Get the tab overlap amount.
   *
   * A positive value will cause neighboring tabs to overlap.
   * A negative value will insert empty space between tabs.
   */
  get tabOverlap(): number {
    return this._tabOverlap;
  }

  /**
   * Set the tab overlap amount.
   *
   * A positive value will cause neighboring tabs to overlap.
   * A negative value will insert empty space between tabs.
   */
  set tabOverlap(overlap: number) {
    if (overlap === this._tabOverlap) {
      return;
    }
    this._tabOverlap = overlap;
    if (this.isAttached) {
      this._updateTabLayout();
      this.updateGeometry();
    }
  }

  /**
   * Get the number of tabs in the tab bar.
   */
  get count(): number {
    return this._tabs.length;
  }

  /**
   * Get the tab at the given index.
   */
  tabAt(index: number): ITab {
    return this._tabs[index];
  }

  /**
   * Get the index of the given tab.
   */
  indexOf(tab: ITab): number {
    return this._tabs.indexOf(tab);
  }

  /**
   * Add a tab to the end of the tab bar.
   *
   * Returns the index of the tab.
   */
  addTab(tab: ITab): number {
    return this.insertTab(this.count, tab);
  }

  /**
   * Insert a tab into the tab bar at the given index.
   *
   * Returns the index of the tab.
   */
  insertTab(index: number, tab: ITab): number {
    index = Math.max(0, Math.min(index | 0, this.count));
    var curr = this.indexOf(tab);
    if (curr !== -1) {
      index = this.moveTab(curr, index);
    } else {
      this._insertWithAnimation(index, tab);
    }
    return index;
  }

  /**
   * Move a tab from one index to another.
   *
   * Returns the new tab index.
   */
  moveTab(fromIndex: number, toIndex: number): number {
    fromIndex = fromIndex | 0;
    var count = this.count;
    if (fromIndex < 0 || fromIndex >= count) {
      return -1;
    }
    toIndex = Math.max(0, Math.min(toIndex | 0, count - 1));
    if (fromIndex === toIndex) {
      return toIndex;
    }
    this._moveTab(fromIndex, toIndex);
    return toIndex;
  }

  /**
   * Remove and return the tab at the given index.
   *
   * Returns `undefined` if the index is out of range.
   */
  removeAt(index: number): ITab {
    var tab = this.tabAt(index);
    if (tab) this._removeTab(index, true);
    return tab;
  }

  /**
   * Remove a tab from the tab bar and return its index.
   *
   * Returns -1 if the tab is not in the tab bar.
   */
  removeTab(tab: ITab): number {
    var i = this.indexOf(tab);
    if (i !== -1) this._removeTab(i, true);
    return i;
  }

  /**
   * Remove all of the tabs from the tab bar.
   */
  clearTabs(): void {
    while (this.count) {
      this._removeTab(this.count - 1, false);
    }
  }

  /**
   * Add a tab to the tab bar at the given client X position.
   *
   * This will insert the tab and grab the mouse to continue the drag.
   * It assumes that the left mouse button is currently pressed.
   */
  attachTab(tab: ITab, clientX: number): void {
    var curr = this._tabs.indexOf(tab);
    var content = this.contentNode;
    var innerRect = content.getBoundingClientRect();
    var localLeft = clientX - innerRect.left;
    var index = localLeft / (this._tabLayoutWidth() - this._tabOverlap);
    index = Math.max(0, Math.min(Math.round(index), this._tabs.length));
    if (curr === -1) {
      this._insertWithoutAnimation(index, tab);
    } else if (curr !== index) {
      this._moveTab(curr, index);
    }
    this.currentIndex = index;
    document.addEventListener('mouseup', <any>this, true);
    document.addEventListener('mousemove', <any>this, true);
    if (!this._movable) {
      return;
    }
    var node = tab.node;
    var tabWidth = this._tabLayoutWidth();
    var offsetX = (0.4 * tabWidth) | 0;
    var localX = clientX - innerRect.left - offsetX;
    var targetX = Math.max(0, Math.min(localX, innerRect.width - tabWidth));
    var clientY = innerRect.top + (0.5 * innerRect.height) | 0;
    var grab = overrideCursor(window.getComputedStyle(node).cursor);
    this._dragData = {
      node: node,
      pressX: clientX,
      pressY: clientY,
      offsetX: offsetX,
      innerRect: innerRect,
      cursorGrab: grab,
      dragActive: true,
      emitted: false,
    };
    content.classList.add(TRANSITION_CLASS);
    node.style.transition = 'none';
    this._updateTabLayout();
    node.style.left = targetX + 'px';
  }

  /**
   * Compute the size hint for the tab bar.
   */
  sizeHint(): Size {
    var width = 0;
    var count = this._tabs.length;
    if (count > 0) {
      var overlap = this._tabOverlap * (count - 1);
      width = this._tabWidth * count - overlap;
    }
    return new Size(width, this.boxSizing().minHeight);
  }

  /**
   * Compute the minimum size hint for the tab bar.
   */
  minSizeHint(): Size {
    var width = 0;
    var count = this._tabs.length;
    if (count > 0) {
      var stub = TAB_STUB_SIZE * (count - 1);
      width = this._minTabWidth + stub;
    }
    return new Size(width, this.boxSizing().minHeight);
  }

  /**
   * Get the content node for the tab bar.
   */
  protected get contentNode(): HTMLElement {
    return <HTMLElement>this.node.firstChild.nextSibling;
  }

  /**
   * Create the DOM node for the tab bar.
   */
  protected createNode(): HTMLElement {
    var node = document.createElement('div');
    var header = document.createElement('div');
    var content = document.createElement('ul');
    var footer = document.createElement('div');
    header.className = HEADER_CLASS;
    content.className = CONTENT_CLASS;
    footer.className = FOOTER_CLASS;
    node.appendChild(header);
    node.appendChild(content);
    node.appendChild(footer);
    return node;
  }

  /**
   * A method invoked on an 'after-attach' message.
   */
  protected onAfterAttach(msg: IMessage): void {
    var node = this.node;
    node.addEventListener('mousedown', <any>this);
    node.addEventListener('click', <any>this);
  }

  /**
   * A method invoked on an 'after-dettach' message.
   */
  protected onAfterDetach(msg: IMessage): void {
    var node = this.node;
    node.removeEventListener('mousedown', <any>this);
    node.removeEventListener('click', <any>this);
  }

  /**
   * A method invoked on a 'resize' message.
   */
  protected onResize(msg: ResizeMessage): void {
    this._updateTabLayout();
  }

  /**
   * Handle the DOM events for the tab bar.
   */
  protected handleEvent(event: Event): void {
    switch (event.type) {
    case 'click':
      this._evtClick(<MouseEvent>event);
      break;
    case 'mousedown':
      this._evtMouseDown(<MouseEvent>event);
      break;
    case 'mousemove':
      this._evtMouseMove(<MouseEvent>event);
      break;
    case 'mouseup':
      this._evtMouseUp(<MouseEvent>event);
      break;
    }
  }

  /**
   * Handle the 'click' event for the tab bar.
   */
  private _evtClick(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }
    var clientX = event.clientX;
    var clientY = event.clientY;
    var index = this._indexAtPos(clientX, clientY);
    if (index < 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    var tab = this._tabs[index];
    var icon = tab.closeIconNode;
    if (icon && icon === event.target && tab.closable) {
      this.tabCloseRequested.emit(this, new Pair(index, tab));
    }
  }

  /**
   * Handle the 'mousedown' event for the tab bar.
   */
  private _evtMouseDown(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }
    var clientX = event.clientX;
    var clientY = event.clientY;
    var index = this._indexAtPos(clientX, clientY);
    if (index < 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    var tab = this._tabs[index];
    var icon = tab.closeIconNode;
    if (icon && icon === event.target) {
      return;
    }
    if (this._movable) {
      var node = tab.node;
      var rect = node.getBoundingClientRect();
      this._dragData = {
        node: node,
        pressX: clientX,
        pressY: clientY,
        offsetX: clientX - rect.left,
        innerRect: null,
        cursorGrab: null,
        dragActive: false,
        emitted: false,
      };
    }
    this.currentIndex = index;
    document.addEventListener('mouseup', <any>this, true);
    document.addEventListener('mousemove', <any>this, true);
  }

  /**
   * Handle the 'mousemove' event for the tab bar.
   */
  private _evtMouseMove(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this._movable || !this._dragData) {
      return;
    }
    var clientX = event.clientX;
    var clientY = event.clientY;
    var data = this._dragData;
    if (!data.dragActive) {
      var dx = Math.abs(clientX - data.pressX);
      var dy = Math.abs(clientY - data.pressY);
      if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
        return;
      }
      var content = this.contentNode;
      var innerRect = content.getBoundingClientRect();
      var cursor = window.getComputedStyle(data.node).cursor;
      var grab = overrideCursor(cursor);
      data.innerRect = innerRect;
      data.cursorGrab = grab;
      data.dragActive = true;
      content.classList.add(TRANSITION_CLASS);
      data.node.style.transition = 'none';
    }
    var tabWidth = this._tabLayoutWidth();
    if (!data.emitted) {
      var innerRect = data.innerRect;
      if (!inBounds(innerRect, DETACH_THRESHOLD, clientX, clientY)) {
        data.emitted = true;
        this.tabDetachRequested.emit(this, {
          tab: this.currentTab,
          index: this.currentIndex,
          clientX: event.clientX,
          clientY: event.clientY,
        });
        if (!this._dragData) { // tab detached
          return;
        }
      }
    }
    var index = this.currentIndex;
    var naturalX = index * (tabWidth - this._tabOverlap);
    var lowerBound = naturalX - tabWidth * OVERLAP_THRESHOLD;
    var upperBound = naturalX + tabWidth * OVERLAP_THRESHOLD;
    var localX = event.clientX - data.innerRect.left - data.offsetX;
    var targetX = Math.max(0, Math.min(localX, this.width - tabWidth));
    if (targetX < lowerBound) {
      this.moveTab(index, index - 1);
    } else if (targetX > upperBound) {
      this.moveTab(index, index + 1);
    }
    data.node.style.left = targetX + 'px';
  }

  /**
   * Handle the 'mouseup' event for the tab bar.
   */
  private _evtMouseUp(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._releaseMouse();
  }

  /**
   * Release the current mouse grab for the tab bar.
   */
  private _releaseMouse(): void {
    var data = this._dragData;
    if (!data) {
      return;
    }
    this._dragData = null;
    document.removeEventListener('mouseup', <any>this, true);
    document.removeEventListener('mousemove', <any>this, true);
    if (data && data.dragActive) {
      data.cursorGrab.dispose();
      data.node.style.transition = '';
      this._withTransition(() => this._updateTabLayout());
    }
  }

  /**
   * Insert a new tab into the tab bar at a valid index.
   */
  private _insertWithAnimation(index: number, tab: ITab): void {
    this._insertCommon(index, tab);
    if (!this.isAttached) {
      return;
    }
    this._withTransition(() => {
      tab.node.classList.add(INSERTING_CLASS);
      this._updateTabLayout();
    }, () => {
      tab.node.classList.remove(INSERTING_CLASS);
    });
    this.updateGeometry();
  }

  private _insertWithoutAnimation(index: number, tab: ITab): void {
    this._insertCommon(index, tab);
    if (!this.isAttached) {
      return;
    }
    this._withTransition(() => this._updateTabLayout());
    this.updateGeometry();
  }

  private _insertCommon(index: number, tab: ITab): void {
    tab.selected = false;
    this._tabs.splice(index, 0, tab);
    this.contentNode.appendChild(tab.node);
    if (!this._currentTab) {
      this.currentTab = tab;
    } else {
      this._refreshTabZOrder();
    }
    if (!this.isAttached) {
      return;
    }
  }

  /**
   * Move an item to a new index in the tab bar.
   */
  private _moveTab(fromIndex: number, toIndex: number): void {
    var tab = this._tabs.splice(fromIndex, 1)[0];
    this._tabs.splice(toIndex, 0, tab);
    this._refreshTabZOrder();
    this.tabMoved.emit(this, new Pair(fromIndex, toIndex));
    if (!this.isAttached) {
      return;
    }
    this._withTransition(() => this._updateTabLayout());
  }

  private _removeWithAnimation(index: number): void {

  }

  private _removeWithoutAnimation(index: number): void {

  }

  private _removeCommon(index: number): void {

  }

  /**
   * Remove the tab at the given index from the tab bar.
   */
  private _removeTab(index: number, animate: boolean): void {
    this._releaseMouse();
    var tabs = this._tabs;
    var tab = tabs.splice(index, 1)[0];
    tab.selected = false;
    tab.node.style.zIndex = '0';
    if (tab === this._currentTab) {
      var next = this._previousTab || tabs[index] || tabs[index - 1];
      this._currentTab = null;
      this._previousTab = null;
      if (next) {
        this.currentTab = next;
      } else {
        this.currentChanged.emit(this, new Pair(-1, void 0));
      }
    } else if (tab === this._previousTab) {
      this._previousTab =  null;
      this._refreshTabZOrder();
    } else {
      this._refreshTabZOrder();
    }
    var content = this.contentNode;
    if (!this.isAttached) {
      content.removeChild(tab.node);
      return;
    }
    if (animate) {
      this._withTransition(() => {
        tab.node.classList.add(REMOVING_CLASS);
        this._updateTabLayout();
      }, () => {
        tab.node.classList.remove(REMOVING_CLASS);
        content.removeChild(tab.node);
      });
    } else {
      content.removeChild(tab.node);
      this._withTransition(() => this._updateTabLayout());
    }
    this.updateGeometry();
  }

  /**
   * Refresh the Z indices of the tab nodes.
   */
  private _refreshTabZOrder(): void {
    var tabs = this._tabs;
    var index = tabs.length - 1;
    for (var i = 0, n = tabs.length; i < n; ++i) {
      var tab = tabs[i];
      if (tab === this._currentTab) {
        tab.node.style.zIndex = tabs.length + '';
      } else {
        tab.node.style.zIndex = index-- + '';
      }
    }
  }

  /**
   * Get the index of the tab which covers the given client position.
   */
  private _indexAtPos(clientX: number, clientY: number): number {
    var tabs = this._tabs;
    for (var i = 0, n = tabs.length; i < n; ++i) {
      if (hitTest(tabs[i].node, clientX, clientY)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Compute the layout width of a tab.
   *
   * This computes a tab size as close as possible to the preferred
   * tab size (but not less than the minimum), taking into account
   * the current tab bar inner div width and tab overlap setting.
   */
  private _tabLayoutWidth(): number {
    var count = this._tabs.length;
    if (count === 0) {
      return 0;
    }
    var totalOverlap = this._tabOverlap * (count - 1);
    var totalWidth = this._tabWidth * count - totalOverlap;
    if (this.width >= totalWidth) {
      return this._tabWidth;
    }
    var ideal = (this.width + totalOverlap) / count;
    return Math.max(this._minTabWidth, ideal);
  }

  /**
   * Update the layout of the tabs in the tab bar.
   *
   * This will update the position and size of the tabs according to
   * the current inner width of the tab bar. The position of the drag
   * tab will not be updated.
   */
  private _updateTabLayout(): void {
    var left = 0;
    var width = this.width;
    var tabs = this._tabs;
    var stub = TAB_STUB_SIZE;
    var data = this._dragData;
    var overlap = this._tabOverlap;
    var tabWidth = this._tabLayoutWidth();
    var dragNode = data && data.dragActive && data.node;
    for (var i = 0, n = tabs.length; i < n; ++i) {
      var node = tabs[i].node;
      var style = node.style;
      if (node !== dragNode) {
        var offset = tabWidth + stub * (n - i - 1);
        if (left + offset > width) {
          left = Math.max(0, width - offset);
        }
        style.left = left + 'px';
      }
      style.width = tabWidth + 'px';
      left += tabWidth - overlap;
    }
  }

  /**
   * A helper function to execute an animated transition.
   *
   * This will execute the enter after the transition class has been
   * added to the tab bar, and execute the exit callback after the
   * transition duration has expired and the transition class has
   * been removed from the tab bar.
   *
   * If there is an active drag in progress, the transition class
   * will not be removed from the inner div on exit.
   */
  private _withTransition(enter?: () => void, exit?: () => void): void {
    var content = this.contentNode;
    content.classList.add(TRANSITION_CLASS);
    if (enter) enter();
    setTimeout(() => {
      var data = this._dragData;
      if (!data || !data.dragActive) {
        content.classList.remove(TRANSITION_CLASS);
      }
      if (exit) exit();
    }, TRANSITION_DURATION);
  }

  private _movable = true;
  private _tabWidth = 175;
  private _tabOverlap = 0;
  private _minTabWidth = 45;
  private _tabs: ITab[] = [];
  private _currentTab: ITab = null;
  private _previousTab: ITab = null;
  private _dragData: IDragData = null;
}


/**
 * An object which holds the drag data for a tab.
 */
interface IDragData {
  /**
   * The drag tab node.
   */
  node: HTMLElement;

  /**
   * The mouse press client X position.
   */
  pressX: number;

  /**
   * The mouse press client Y position.
   */
  pressY: number;

  /**
   * The mouse X position in tab coordinates.
   */
  offsetX: number;

  /**
   * The client rect of the inner tab bar node.
   */
  innerRect: ClientRect;

  /**
   * The disposable to clean up the cursor override.
   */
  cursorGrab: IDisposable;

  /**
   * Whether the drag is currently active.
   */
  dragActive: boolean;

  /**
   * Whether the detach request signal has been emitted.
   */
  emitted: boolean;
}


/**
 * Test whether a point lies within an expanded rect.
 */
function inBounds(r: ClientRect, v: number, x: number, y: number) {
  if (x < r.left - v) {
    return false;
  }
  if (x >= r.right + v) {
    return false;
  }
  if (y < r.top - v) {
    return false;
  }
  if (y >= r.bottom + v) {
    return false;
  }
  return true;
}

} // module phosphor.widgets
