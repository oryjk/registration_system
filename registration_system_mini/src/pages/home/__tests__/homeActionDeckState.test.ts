import { expect, test } from 'bun:test';
import { resolveDeckSwipe, deckBoundaryMessage, resolveDeckAxis, deckDragOffset } from '../homeActionDeckState';
test('deck turns horizontally and leaves vertical gestures to page scrolling', () => {
  expect(resolveDeckSwipe(-60, 2)).toEqual(1);
  expect(resolveDeckSwipe(60, 2)).toEqual(-1);
  expect(resolveDeckSwipe(20, 0)).toEqual(0);
  expect(resolveDeckSwipe(2, 80)).toEqual(0);
  expect(resolveDeckSwipe(2, -80)).toEqual(0);
  expect(resolveDeckSwipe(50, 50)).toEqual(0);
});

test('deck boundaries explain why a swipe cannot turn the card', () => {
  expect(deckBoundaryMessage(0, 3, -1)).toEqual('已经是最早的比赛了');
  expect(deckBoundaryMessage(2, 3, 1)).toEqual('没有更多的比赛了');
  expect(deckBoundaryMessage(1, 3, 1)).toEqual('');
  expect(deckBoundaryMessage(1, 3, -1)).toEqual('');
  expect(deckBoundaryMessage(0, 1, -1)).toEqual('已经是最早的比赛了');
  expect(deckBoundaryMessage(0, 1, 1)).toEqual('没有更多的比赛了');
  expect(deckBoundaryMessage(0, 0, 1)).toEqual('');
});

test('drag follows the finger with resistance only at the deck boundaries', () => {
  expect(deckDragOffset(-80, 0, 3)).toEqual(-80);
  expect(deckDragOffset(80, 1, 3)).toEqual(80);
  expect(deckDragOffset(100, 0, 3)).toEqual(22);
  expect(deckDragOffset(-100, 2, 3)).toEqual(-22);
  expect(deckDragOffset(-1000, 2, 3)).toEqual(-48);
  expect(deckDragOffset(100, 0, 1)).toEqual(22);
});
test('direction locking ignores taps and reserves vertical or diagonal movement for scrolling', () => {
  expect(resolveDeckAxis(3, 4)).toEqual('pending');
  expect(resolveDeckAxis(-20, 3)).toEqual('horizontal');
  expect(resolveDeckAxis(3, -20)).toEqual('vertical');
  expect(resolveDeckAxis(15, 15)).toEqual('vertical');
});
