import { createSlice } from '@reduxjs/toolkit';

// Initial state
const initialState = {
  username: '',
  roomId: '',
  isCreator: false,
  score: 0,
  hasGuessed: false
};

// Create slice
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserInfo: (state, action) => {
      state.username = action.payload.username;
      state.roomId = action.payload.roomId;
      state.isCreator = action.payload.isCreator;
    },
    setScore: (state, action) => {
      state.score = action.payload;
    },
    setHasGuessed: (state, action) => {
      state.hasGuessed = action.payload;
    },
    resetUser: () => initialState
  }
});

// Export actions
export const {
  setUserInfo,
  setScore,
  setHasGuessed,
  resetUser
} = userSlice.actions;

// Selectors
export const selectUsername = (state) => state.user.username;
export const selectRoomId = (state) => state.user.roomId;
export const selectIsCreator = (state) => state.user.isCreator;
export const selectScore = (state) => state.user.score;
export const selectHasGuessed = (state) => state.user.hasGuessed;

// Export reducer
export default userSlice.reducer;