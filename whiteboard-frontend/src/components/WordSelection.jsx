
import React from 'react';

const WordSelection = ({ onWordSelect }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-xl font-bold mb-4 text-center">Select Word Difficulty</h3>
        <div className="flex flex-col space-y-3">
          <button 
            onClick={() => onWordSelect('easy')}
            className="bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-lg transition text-lg"
          >
            Easy
          </button>
          <button 
            onClick={() => onWordSelect('medium')}
            className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-6 rounded-lg transition text-lg"
          >
            Medium
          </button>
          <button 
            onClick={() => onWordSelect('hard')}
            className="bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-lg transition text-lg"
          >
            Hard
          </button>
        </div>
      </div>
    </div>
  );
};

export default WordSelection;
