import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isDrawing: false,
  tool: 'pencil',
  pointerSize: 5,
  selectedColor: 'black',
  lastPos: null
};

export const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    setIsDrawing: (state, action) => {
      state.isDrawing = action.payload;
    },
    setTool: (state, action) => {
      state.tool = action.payload;
    },
    setPointerSize: (state, action) => {
      state.pointerSize = action.payload;
    },
    setSelectedColor: (state, action) => {
      state.selectedColor = action.payload;
    },
    setLastPos: (state, action) => {
      state.lastPos = action.payload;
    }
  }
});

export const {
  setIsDrawing,
  setTool,
  setPointerSize,
  setSelectedColor,
  setLastPos
} = canvasSlice.actions;

export default canvasSlice.reducer;