import React, { useRef, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

const Canvas = () => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil');
  const [pointerSize, setPointerSize] = useState(5);
  const [selectedColor, setSelectedColor] = useState('black');
  const [lastPos, setLastPos] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);
  
  // Get room ID and username from URL params
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const username = queryParams.get('username');
  const roomId = queryParams.get('roomId');

  const colorPalette = [
    'black', 'red', 'blue', 'green', 'yellow', 'purple',
    'orange', 'pink', 'brown', 'gray', 'cyan', 'lime',
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    contextRef.current = context;

    // Join room when component mounts
    if (roomId && username) {
      socket.emit('joinRoom', roomId, username);
    }

    // Socket event listeners
    socket.on('draw', ({ prevX, prevY, x, y, size, color }) => {
      const context = contextRef.current;
      context.lineWidth = size;
      context.strokeStyle = color;
      context.beginPath();
      context.moveTo(prevX, prevY);
      context.lineTo(x, y);
      context.stroke();
    });

    socket.on('clear', () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
    });

    socket.on('userJoined', (user) => {
      setRoomUsers(prev => [...prev, user]);
    });

    socket.on('userLeft', (userId) => {
      setRoomUsers(prev => prev.filter(user => user.userId !== userId));
    });

    socket.on('roomUsers', (users) => {
      setRoomUsers(users);
    });

    // Clean up on unmount
    return () => {
      socket.off('draw');
      socket.off('clear');
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('roomUsers');
      if (roomId) {
        socket.emit('leaveRoom', roomId);
      }
    };
  }, [roomId, username]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clear', roomId);
  };

  const startDrawing = (e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    setLastPos({ x: offsetX, y: offsetY });
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    setIsDrawing(false);
    setLastPos(null);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const { offsetX, offsetY } = e.nativeEvent;
    const context = contextRef.current;

    if (tool === 'pencil') {
      context.lineWidth = pointerSize;
      context.strokeStyle = selectedColor;

      context.beginPath();
      context.moveTo(lastPos.x, lastPos.y);
      context.lineTo(offsetX, offsetY);
      context.stroke();

      socket.emit('draw', {
        prevX: lastPos.x,
        prevY: lastPos.y,
        x: offsetX,
        y: offsetY,
        size: pointerSize,
        color: selectedColor,
        roomId: roomId
      });

      setLastPos({ x: offsetX, y: offsetY });
    } else if (tool === 'erase') {
      context.clearRect(
        offsetX - pointerSize / 2,
        offsetY - pointerSize / 2,
        pointerSize,
        pointerSize
      );
    }
  };

  return (
    <div className="relative h-screen bg-gray-100">
      {/* Room Info Bar */}
      <div className="absolute top-4 right-4 z-10 bg-white shadow-md rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <span className="font-semibold">Room:</span>
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-mono">
            {roomId}
          </span>
          <button 
            onClick={() => navigator.clipboard.writeText(roomId)}
            className="text-gray-500 hover:text-gray-700"
            title="Copy room ID"
          >
            📋
          </button>
        </div>
        <div>
          <span className="font-semibold">Users:</span>
          <div className="mt-1 space-y-1">
            {roomUsers.map(user => (
              <div key={user.userId} className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                <span>{user.username}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 bg-white shadow-md rounded-lg p-4 space-y-4">
        <div className="flex space-x-4">
          <button
            className={`px-4 py-2 rounded ${
              tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-600'
            }`}
            onClick={() => setTool('pencil')}
          >
            ✏️ Pencil
          </button>
          <button
            className={`px-4 py-2 rounded ${
              tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
            onClick={() => setTool('erase')}
          >
            🧹 Eraser
          </button>
          <button className="px-4 py-2 bg-red-500 text-white rounded" onClick={clearCanvas}>
            🗑️ Clear
          </button>
        </div>

        {/* Pointer Size */}
        <div className="flex items-center space-x-2">
          <label className="text-gray-700 font-medium">Pointer Size:</label>
          <input
            type="range"
            min="2"
            max="20"
            value={pointerSize}
            onChange={(e) => setPointerSize(Number(e.target.value))}
            className="w-24"
          />
        </div>

        {/* Color Palette */}
        <div className="grid grid-cols-4 gap-2">
          {colorPalette.map((color) => (
            <button
              key={color}
              className={`w-8 h-8 rounded-full border-2 ${
                selectedColor === color ? 'border-gray-700' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setSelectedColor(color)}
            />
          ))}
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseUp={finishDrawing}
        onMouseMove={draw}
        className="w-full h-full bg-white"
      />
    </div>
  );
};

export default Canvas;
// import React, { useRef, useEffect, useState } from 'react';
// import { io } from 'socket.io-client';

// const socket = io('http://localhost:5000');

// const Canvas = () => {
//   const canvasRef = useRef(null);
//   const contextRef = useRef(null);
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [tool, setTool] = useState('pencil');
//   const [pointerSize, setPointerSize] = useState(5);
//   const [selectedColor, setSelectedColor] = useState('black');
//   const [lastPos, setLastPos] = useState(null); // Track the last position

//   const colorPalette = [
//     'black', 'red', 'blue', 'green', 'yellow', 'purple',
//     'orange', 'pink', 'brown', 'gray', 'cyan', 'lime',
//   ];

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     canvas.width = window.innerWidth;
//     canvas.height = window.innerHeight;

//     const context = canvas.getContext('2d');
//     context.lineCap = 'round';
//     contextRef.current = context;

//     // Listen for drawing events
//     socket.on('draw', ({ prevX, prevY, x, y, size, color }) => {
//       const context = contextRef.current;
//       context.lineWidth = size;
//       context.strokeStyle = color;
//       context.beginPath();
//       context.moveTo(prevX, prevY);
//       context.lineTo(x, y);
//       context.stroke();
//     });

//     // Listen for clear events
//     socket.on('clear', () => {
//       context.clearRect(0, 0, canvas.width, canvas.height);
//     });
//   }, []);

//   const clearCanvas = () => {
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     socket.emit('clear');
//   };

//   const startDrawing = (e) => {
//     const { offsetX, offsetY } = e.nativeEvent;
//     setLastPos({ x: offsetX, y: offsetY });
//     setIsDrawing(true);
//   };

//   const finishDrawing = () => {
//     setIsDrawing(false);
//     setLastPos(null);
//   };

//   const draw = (e) => {
//     if (!isDrawing) return;

//     const { offsetX, offsetY } = e.nativeEvent;
//     const context = contextRef.current;

//     // Draw on the canvas
//     if (tool === 'pencil') {
//       context.lineWidth = pointerSize;
//       context.strokeStyle = selectedColor;

//       context.beginPath();
//       context.moveTo(lastPos.x, lastPos.y);
//       context.lineTo(offsetX, offsetY);
//       context.stroke();

//       // Emit drawing event
//       socket.emit('draw', {
//         prevX: lastPos.x,
//         prevY: lastPos.y,
//         x: offsetX,
//         y: offsetY,
//         size: pointerSize,
//         color: selectedColor,
//       });

//       setLastPos({ x: offsetX, y: offsetY });
//     } else if (tool === 'erase') {
//       context.clearRect(
//         offsetX - pointerSize / 2,
//         offsetY - pointerSize / 2,
//         pointerSize,
//         pointerSize
//       );
//     }
//   };

//   return (
//     <div className="relative h-screen bg-gray-100">
//       {/* Toolbar */}
//       <div className="absolute top-4 left-4 z-10 bg-white shadow-md rounded-lg p-4 space-y-4">
//         <div className="flex space-x-4">
//           <button
//             className={`px-4 py-2 rounded ${
//               tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-600'
//             }`}
//             onClick={() => setTool('pencil')}
//           >
//             ✏️ Pencil
//           </button>
//           <button
//             className={`px-4 py-2 rounded ${
//               tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-600'
//             }`}
//             onClick={() => setTool('erase')}
//           >
//             🧹 Eraser
//           </button>
//           <button className="px-4 py-2 bg-red-500 text-white rounded" onClick={clearCanvas}>
//             🗑️ Clear
//           </button>
//         </div>

//         {/* Pointer Size */}
//         <div className="flex items-center space-x-2">
//           <label className="text-gray-700 font-medium">Pointer Size:</label>
//           <input
//             type="range"
//             min="2"
//             max="20"
//             value={pointerSize}
//             onChange={(e) => setPointerSize(Number(e.target.value))}
//             className="w-24"
//           />
//         </div>

//         {/* Color Palette */}
//         <div className="grid grid-cols-4 gap-2">
//           {colorPalette.map((color) => (
//             <button
//               key={color}
//               className={`w-8 h-8 rounded-full border-2 ${
//                 selectedColor === color ? 'border-gray-700' : 'border-transparent'
//               }`}
//               style={{ backgroundColor: color }}
//               onClick={() => setSelectedColor(color)}
//             />
//           ))}
//         </div>
//       </div>

//       {/* Canvas */}
//       <canvas
//         ref={canvasRef}
//         onMouseDown={startDrawing}
//         onMouseUp={finishDrawing}
//         onMouseMove={draw}
//         className="w-full h-full bg-white"
//       />
//     </div>
//   );
// };

// export default Canvas;



// import React, { useRef, useEffect, useState } from 'react';
// import { io } from 'socket.io-client';

// // Connect to the backend server
// const socket = io('http://localhost:5000');

// const Canvas = () => {
//   const canvasRef = useRef(null);
//   const contextRef = useRef(null);
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [tool, setTool] = useState('pencil'); // State for tool selection
//   const [pointerSize, setPointerSize] = useState(5); // State for pointer size
//   const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 }); // Cursor position for custom cursor
//   const [canvasOffset, setCanvasOffset] = useState({ top: 0, left: 0 }); // Canvas offset in the document
//   const [selectedColor, setSelectedColor] = useState('black'); // State for selected color

//   // Setup canvas and Socket.IO listeners
//   useEffect(() => {
//     const canvas = canvasRef.current;
//     canvas.width = window.innerWidth;
//     canvas.height = window.innerHeight;

//     const context = canvas.getContext('2d');
//     context.lineCap = 'round';
//     context.strokeStyle = selectedColor; // Set initial color
//     contextRef.current = context;

//     // Calculate canvas position relative to the viewport
//     const { top, left } = canvas.getBoundingClientRect();
//     setCanvasOffset({ top, left });

//     // Listen for drawing events from other users
//     socket.on('draw', ({ prevX, prevY, x, y, size, color }) => {
//       context.lineWidth = size;
//       context.strokeStyle = color; // Use the color received from socket event
//       context.beginPath();
//       context.moveTo(prevX, prevY);
//       context.lineTo(x, y);
//       context.stroke();
//       context.closePath();
//     });

//     socket.on('clear', () => {
//       context.clearRect(0, 0, canvas.width, canvas.height);
//     });
//   }, [selectedColor]); // Re-run when the selected color changes

//   // Start drawing or erasing
//   const startDrawing = ({ nativeEvent }) => {
//     const { offsetX, offsetY } = getAdjustedCoordinates(nativeEvent);

//     if (tool === 'erase') {
//       contextRef.current.clearRect(
//         offsetX - pointerSize / 2,
//         offsetY - pointerSize / 2,
//         pointerSize,
//         pointerSize
//       );
//     } else {
//       contextRef.current.lineWidth = pointerSize; // Update line width
//       contextRef.current.strokeStyle = selectedColor; // Set selected color for pencil tool
//       contextRef.current.beginPath();
//       contextRef.current.moveTo(offsetX, offsetY);
//       setIsDrawing(true);
//     }
//   };

//   // Finish drawing or erasing
//   const finishDrawing = () => {
//     contextRef.current.closePath();
//     setIsDrawing(false);
//   };

//   // Draw or erase depending on the tool
//   const draw = ({ nativeEvent }) => {
//     if (!isDrawing) return;

//     const { offsetX, offsetY } = getAdjustedCoordinates(nativeEvent);
//     const context = contextRef.current;
//     const prevX = context.currentX || offsetX;
//     const prevY = context.currentY || offsetY;

//     if (tool === 'pencil') {
//       context.lineWidth = pointerSize;
//       context.lineTo(offsetX, offsetY);
//       context.stroke();
//       socket.emit('draw', {
//         prevX,
//         prevY,
//         x: offsetX,
//         y: offsetY,
//         size: pointerSize,
//         color: selectedColor, // Emit the selected color
//       });
//     } else if (tool === 'erase') {
//       context.clearRect(
//         offsetX - pointerSize / 2,
//         offsetY - pointerSize / 2,
//         pointerSize,
//         pointerSize
//       );
//     }

//     context.currentX = offsetX;
//     context.currentY = offsetY;
//   };

//   // Adjust cursor position to account for canvas offset
//   const updateCursor = ({ nativeEvent }) => {
//     const { offsetX, offsetY } = getAdjustedCoordinates(nativeEvent);
//     setCursorPosition({ x: offsetX, y: offsetY });
//   };

//   // Clear the canvas
//   const clearCanvas = () => {
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     socket.emit('clear');
//   };

//   // Adjust event coordinates to account for canvas offset
//   const getAdjustedCoordinates = (nativeEvent) => {
//     const { clientX, clientY } = nativeEvent;
//     return {
//       offsetX: clientX - canvasOffset.left,
//       offsetY: clientY - canvasOffset.top,
//     };
//   };

//   return (
//     <div className="relative h-screen bg-gray-100">
//       {/* Tool Controls */}
//       <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center space-x-4 p-4 bg-white shadow-lg rounded-md">
//         <button
//           className={`px-4 py-2 rounded ${
//             tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-600'
//           }`}
//           onClick={() => setTool('pencil')}
//         >
//           ✏️ Pencil
//         </button>
//         <button
//           className={`px-4 py-2 rounded ${
//             tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-600'
//           }`}
//           onClick={() => setTool('erase')}
//         >
//           🧹 Eraser
//         </button>
//         <button
//           className="px-4 py-2 bg-red-500 text-white rounded"
//           onClick={clearCanvas}
//         >
//           🗑️ Clear
//         </button>
//         <div className="flex items-center space-x-2">
//           <label className="text-gray-700 font-medium">Pointer Size:</label>
//           <input
//             type="range"
//             min="2"
//             max="20"
//             value={pointerSize}
//             onChange={(e) => setPointerSize(Number(e.target.value))}
//             className="w-24"
//           />
//         </div>
//         {/* Color Palette */}
//         <div className="flex items-center space-x-2">
//           {['black', 'red', 'blue', 'green', 'yellow', 'purple'].map((color) => (
//             <button
//               key={color}
//               className={`w-8 h-8 rounded-full border-2 ${
//                 selectedColor === color ? 'border-gray-700' : 'border-transparent'
//               }`}
//               style={{ backgroundColor: color }}
//               onClick={() => setSelectedColor(color)}
//             />
//           ))}
//         </div>
//       </div>

//       {/* Custom Cursor */}
//       <div
//         style={{
//           position: 'absolute',
//           left: cursorPosition.x - pointerSize / 2,
//           top: cursorPosition.y - pointerSize / 2,
//           width: pointerSize,
//           height: pointerSize,
//           backgroundColor: tool === 'erase' ? 'white' : selectedColor,
//           border:
//             tool === 'erase'
//               ? '1px solid gray'
//               : `1px solid ${tool === 'pencil' ? selectedColor : 'transparent'}`,
//           borderRadius: '50%',
//           pointerEvents: 'none',
//           zIndex: 9999,
//         }}
//       />

//       {/* Canvas */}
//       <canvas
//         ref={canvasRef}
//         onMouseDown={startDrawing}
//         onMouseUp={finishDrawing}
//         onMouseLeave={finishDrawing}
//         onMouseMove={(e) => {
//           updateCursor(e);
//           draw(e);
//         }}
//         className="w-full h-full bg-white shadow-lg"
//       />
//     </div>
//   );
// };

// export default Canvas;









