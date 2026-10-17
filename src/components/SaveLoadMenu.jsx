import React from 'react';
import { saveGameProgress, loadGameProgress, deleteSaveGame } from '../utils/saveLoadUtils';
import '../styles/SaveLoadMenu.css';

const SaveLoadMenu = ({ 
  characterStats, 
  obtainedRelics, 
  inventory,
  position,
  worldState,
  onLoad,
  onClose,
  setUseItemMessage 
}) => {
  const handleSave = () => {
    const gameData = {
      characterStats,
      obtainedRelics,
      inventory,
      position,
      worldState,
      savedAt: new Date().toLocaleString()
    };

    if (saveGameProgress(gameData)) {
      setUseItemMessage('Game saved successfully!');
      setTimeout(() => setUseItemMessage(''), 3000);
    } else {
      setUseItemMessage('Failed to save game!');
      setTimeout(() => setUseItemMessage(''), 3000);
    }
  };

  const handleLoad = () => {
    const savedData = loadGameProgress();
    if (savedData) {
      onLoad(savedData);
      setUseItemMessage('Game loaded successfully!');
      setTimeout(() => setUseItemMessage(''), 3000);
    } else {
      setUseItemMessage('No saved game found!');
      setTimeout(() => setUseItemMessage(''), 3000);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete your saved game?')) {
      if (deleteSaveGame()) {
        setUseItemMessage('Save file deleted!');
        setTimeout(() => setUseItemMessage(''), 3000);
      }
    }
  };

  return (
    <div className="save-load-menu" role="dialog" aria-label="Save and load">
      <h2>Save/Load Game</h2>
      <div className="save-load-buttons">
        <button onClick={handleSave} className="save-button">
          Save Game
        </button>
        <button onClick={handleLoad} className="load-button">
          Load Game
        </button>
        <button onClick={handleDelete} className="delete-button">
          Delete Save
        </button>
        <button onClick={onClose} className="close-button">
          Close
        </button>
      </div>
    </div>
  );
};

export default SaveLoadMenu;
