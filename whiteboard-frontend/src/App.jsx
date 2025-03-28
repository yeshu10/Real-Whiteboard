// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import RoomAccess from './components/RoomAccess';
import Canvas from './components/Canvas';

function App() {
  return (
    <Routes>
      <Route path="/" element={<RoomAccess />} />
      <Route path="/canvas" element={<Canvas />} />
    </Routes>
  );
}

export default App;