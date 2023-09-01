import { useGlobal } from 'reactn';
import { FC, useEffect, useState } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import Watcher from '../main/file-watcher';
import FilePathSelect from './components/FilePathSelect';
import HistoryLog from './components/HistoryLog';

const DEBUG = false;

interface MockType {
  [key: string]: string | undefined;
}

interface FileInfo {
  characterName: string;
  serverName: string;
  currentFile: string;
  filePath: string;
}

const extractFileInfo = (path: string) => {
  const parts = path.split('\\');
  const fileNameParts = parts.pop()?.split('_');
  const characterName = fileNameParts?.[1] || '';
  const serverName = fileNameParts?.[2]?.split('.')?.[0] || '';

  return {
    filePath: parts.join('\\'),
    characterName,
    serverName,
    currentFile: fileNameParts?.join('_') || '',
  };
};

type FileWatcherProps = RouteComponentProps<MockType, MockType, { raid: Raid }>;
let lines: { line: string; date: string }[] = [];

const FileWatcher: FC<FileWatcherProps> = ({ history }) => {
  // const [overlayVisible, setOverlayVisible] = useState(false);
  const [filePath, setFilePath] = useState<string>(
    localStorage.getItem('filePath') || ''
  );
  const [fileInfo, setFileInfo] = useState<FileInfo | undefined>(
    extractFileInfo(filePath)
  );
  const [streaming, setStreaming] = useState(false);
  const [_rawLines, setLines] = useGlobal('history');

  useEffect(() => {
    window.ipc.stopTail();
    // window.ipc.getWindowVisibleState();
    // window.electron.setStreaming(false);
  }, [fileInfo]);

  function streamLogs() {
    if (!filePath) {
      return;
    }
    if (streaming) {
      window.ipc.stopTail();
      setStreaming(false);
      return;
    }
    try {
      const watcher = new Watcher({
        raidId: history.location.state.raid.id,
        seekFrom: DEBUG ? 0 : new Date().getTime(),
        ...fileInfo,
      });

      watcher.start((line) => {
        console.log(line);
        lines = [...lines.slice(-3), { date: new Date().toISOString(), line }];
        setLines(lines);
        if (!streaming || line === 'START') {
          setStreaming(true);
        }

        if (line === 'STOP') {
          setStreaming(false);
          lines = [
            {
              line: 'Select a file to parse...',
              date: new Date().toISOString(),
            },
          ];
          setLines(lines);
        }

        if (line === 'FINAL TICK') {
          setStreaming(false);
          setLines([
            ...lines,
            { line: 'Final attendance taken', date: new Date().toISOString() },
          ]);
        }
      });
    } catch (e) {
      setStreaming(false);
      setLines([]);
      throw e;
    }
  }

  return (
    <div className="rounded-md flex flex-col gap-3 w-96 px-6 py-6 bg-gradient-to-b from-gray-800 to-slate-900">
      <h1>
        Raid:
        <Link className="text-blue-500" to="/">
          {history.location.state?.raid?.name} (update me)
        </Link>
      </h1>
      <FilePathSelect
        filePath={fileInfo?.currentFile || ''}
        onChange={async (e) => {
          const path = e?.target?.files?.[0]?.path || '';
          setFilePath(path);
          setFileInfo(extractFileInfo(path));
          localStorage.setItem('filePath', path);
          console.log(path);
        }}
      />

      <button
        className={`disabled:bg-gray-400 disabled:cursor-not-allowed text-white ${
          streaming ? 'bg-red-500' : 'bg-green-500'
        }`}
        onClick={streamLogs}
        type="button"
        {...(filePath.length === 0 ? { disabled: true } : {})}
      >
        {streaming ? (
          <div className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Stop streaming</span>
          </div>
        ) : (
          'Start streaming'
        )}
      </button>

      <HistoryLog />
    </div>
  );
};

export default withRouter(FileWatcher);
