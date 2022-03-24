import { FC, useEffect, useState } from 'react';

interface HistoryLogProps {
  lines: string[];
}

const HistoryLog: FC<HistoryLogProps> = ({ lines }) => {
  const [renderLines, setRenderLines] = useState<string[]>([]);

  useEffect(() => {
    if (lines.length > 0) {
      setRenderLines(lines);
    }
  }, [lines]);

  return (
    <div className="absolute max-h-48 w-full overflow-y-scroll bottom-0 left-0">
      {renderLines.map((line, idx) => (
        <p key={idx}>{line}</p>
      ))}
    </div>
  );
};

export default HistoryLog;
