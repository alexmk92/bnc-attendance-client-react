import { FC, useState, useEffect, ChangeEventHandler } from 'react';

interface CharacterSelectProps {
  characters: { name: string; file: string }[];
  onChange: ChangeEventHandler<HTMLSelectElement>;
}

const CharacterSelect: FC<CharacterSelectProps> = ({
  characters,
  onChange,
}) => {
  const [options, setOptions] = useState<{ name: string; file: string }[]>([]);

  useEffect(() => {
    console.log(characters);
    if (characters.length > 0) {
      setOptions(characters);
    }
  }, [characters]);

  return (
    <div>
      <select className="text-black" onChange={onChange}>
        {options.map((c) => {
          return (
            <option key={`char-${c.name}`} value={c.file}>
              {c.name}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default CharacterSelect;
