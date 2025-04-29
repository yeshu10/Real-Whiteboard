import React, { useState, useEffect, useRef } from 'react';

const ChatBox = ({ onSendMessage, messages, isDrawing, currentWord, hasGuessed }) => {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Determine if chat input should be shown
  const showChatInput = currentWord && !hasGuessed && !isDrawing;

  return (
    <div className="absolute right-4 bottom-4 w-80 bg-white rounded-lg shadow-lg flex flex-col h-[400px]">
      <div className="p-3 border-b font-semibold flex justify-between items-center">
        <span>Chat</span>
        {currentWord && hasGuessed && (
          <span className="text-sm bg-green-100 px-2 py-1 rounded">You guessed it!</span>
        )}
        {isDrawing && currentWord && (
          <span className="text-sm bg-yellow-100 px-2 py-1 rounded">You're drawing!</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`p-2 rounded ${
              msg.isCorrect ? 'bg-green-100 border-l-4 border-green-500' : 
              msg.isSystem ? 'bg-gray-100 text-gray-600 text-sm' : 'bg-gray-50'
            }`}
          >
            {msg.isSystem ? (
              <span>{msg.message}</span>
            ) : (
              <>
                <strong className={msg.isCorrect ? 'text-green-700' : ''}>
                  {msg.username}:
                </strong> {msg.message}
                {msg.isCorrect && (
                  <span className="float-right text-green-600 font-bold">+{msg.points}</span>
                )}
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {showChatInput && (
        <form onSubmit={handleSubmit} className="p-3 border-t">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type your guess..."
            autoComplete="off"
          />
        </form>
      )}
      {!currentWord && (
        <div className="p-3 border-t text-sm text-gray-500">
          Waiting for word selection...
        </div>
      )}
    </div>
  );
};

export default ChatBox;

