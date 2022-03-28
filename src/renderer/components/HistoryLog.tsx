import { FC } from 'react';
import { useGlobal } from 'reactn';

const HistoryLog: FC = () => {
  const [lines] = useGlobal('history');

  return (
    <div className="absolute max-h-48 w-full overflow-y-scroll bottom-0 left-0">
      {lines.map((line, idx) => (
        <p key={`line-${idx}`}>{line}</p>
      ))}
    </div>
  );
};

export default HistoryLog;
