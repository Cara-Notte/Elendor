import React from 'react';

const CharacterCard = ({ character, onClick, className = '' }) => {
  const getCharacterLogo = (name) => {
    return `/assets/logo/${name.toLowerCase()}-logo.png`;
  };

  return (
    <div className="card-container">
      <div className={`character-card ${className}`} role="button" tabIndex={0}
        aria-label={`Choose ${character.name}`} onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        }}>
        <div className="card-face card-front">
          <img 
            src={getCharacterLogo(character.name)} 
            alt={`${character.name} logo`} 
            className="card-logo"
            onError={(e) => {
              console.error(`Failed to load logo for ${character.name}`);
              e.target.style.display = 'none';
            }}
          />
        </div>
        <div className="card-face card-back">
          <h2 className="card-title">{character.name}</h2>
          <img 
            src={character.image} 
            alt={character.name} 
            className="card-image"
            onError={(e) => {
              console.error(`Failed to load image for ${character.name}`);
              e.target.style.display = 'none';
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CharacterCard;
