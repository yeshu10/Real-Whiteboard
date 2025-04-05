import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  gameState: 'waiting',
  currentWord: '',
  isDrawingTurn: false,
  users: {},
  currentRound: 0,
  maxRounds: 3,
  timeLeft: 0,
  hasGuessed: false,
  score: 0,
  currentDrawer: null,
  flashMessage: null
};

export const gameSlice = createSlice({
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
    setHasGuessed: (state, action) => {
      state.hasGuessed = action.payload;
    },
    setScore: (state, action) => {
      state.score = action.payload;
    },
    setCurrentDrawer: (state, action) => {
      state.currentDrawer = action.payload;
    },
    setFlashMessage: (state, action) => {
      state.flashMessage = action.payload;
    },
    updateUserScore: (state, action) => {
      const { userId, score } = action.payload;
      if (state.users[userId]) {
        state.users[userId].score = score;
      }
    }
  }
});

export const {
  setGameState,
  setCurrentWord,
  setIsDrawingTurn,
  setUsers,
  setCurrentRound,
  setMaxRounds,
  setTimeLeft,
  setHasGuessed,
  setScore,
  setCurrentDrawer,
  setFlashMessage,
  updateUserScore
} = gameSlice.actions;

export default gameSlice.reducer;