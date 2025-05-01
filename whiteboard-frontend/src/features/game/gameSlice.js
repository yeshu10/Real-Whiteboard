import { createSlice } from '@reduxjs/toolkit';

// Initial state
const initialState = {
  gameState: 'waiting',
  currentWord: '',
  isDrawingTurn: false,
  messages: [],
  users: {},
  currentRound: 0,
  maxRounds: 0,
  timeLeft: 0,
  currentDrawer: null
};

// Create slice
const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setGameState: (state, action) => {
      state.gameState = action.payload;
    },
    setCurrentWord: (state, action) => {
      state.currentWord = action.payload;
    },
    setIsDrawingTurn: (state, action) => {
      state.isDrawingTurn = action.payload;
    },
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    setUsers: (state, action) => {
      state.users = action.payload;
    },
    setCurrentRound: (state, action) => {
      state.currentRound = action.payload;
    },
    setMaxRounds: (state, action) => {
      state.maxRounds = action.payload;
    },
    setTimeLeft: (state, action) => {
      state.timeLeft = action.payload;
    },
    setCurrentDrawer: (state, action) => {
      state.currentDrawer = action.payload;
    },
    resetGame: () => initialState
  }
});

// Export actions
export const {
  setGameState,
  setCurrentWord,
  setIsDrawingTurn,
  addMessage,
  setUsers,
  setCurrentRound,
  setMaxRounds,
  setTimeLeft,
  setCurrentDrawer,
  resetGame
} = gameSlice.actions;

// Selectors
export const selectGameState = (state) => state.game.gameState;
export const selectCurrentWord = (state) => state.game.currentWord;
export const selectIsDrawingTurn = (state) => state.game.isDrawingTurn;
export const selectMessages = (state) => state.game.messages;
export const selectUsers = (state) => state.game.users;
export const selectCurrentRound = (state) => state.game.currentRound;
export const selectTimeLeft = (state) => state.game.timeLeft;
export const selectCurrentDrawer = (state) => state.game.currentDrawer;
export const selectMaxRounds = (state) => state.game.maxRounds;

// Export reducer
export default gameSlice.reducer;