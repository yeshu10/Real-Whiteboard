import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './features/game/gameSlice';
import canvasReducer from './features/canvas/canvasSlice';
import chatReducer from './features/chat/chatSlice';

export const store = configureStore({
  reducer: {
    game: gameReducer,
    canvas: canvasReducer,
    chat: chatReducer
  }
});