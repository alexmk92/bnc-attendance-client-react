import { FC } from 'react';
import { useGlobal } from 'reactn';
import { prettyDate } from '../helpers';

const HistoryLog: FC = () => {
  const [lines] = useGlobal('history');

  return (
    <div className="p-2 text-sm absolute max-h-48 w-full overflow-hidden bottom-0 left-0">
      {lines.map(({ line, date }, idx) => (
        <p key={`line-${idx}`}>
          <span className="text-gray-500">[{prettyDate(date)}]</span> {line}
        </p>
      ))}
    </div>
  );
};

export default HistoryLog;
