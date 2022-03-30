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
  const characterName = fileNameParts?.[2] || '';
  const serverName = fileNameParts?.[1]?.split('.')?.[0] || '';

  return {
    filePath: parts.join('\\'),
    characterName,
    serverName,
    currentFile: fileNameParts?.join('_') || '',
  };
};

type FileWatcherProps = RouteComponentProps<MockType, MockType, { raid: Raid }>;

const FileWatcher: FC<FileWatcherProps> = ({ history }) => {
  const [filePath, setFilePath] = useState<string>('');
  const [fileInfo, setFileInfo] = useState<FileInfo | undefined>();
  const [streaming, setStreaming] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    console.log(fileInfo);
    window.ipc.stopTail();
    setStreaming(false);
    setLines([]);
  }, [fileInfo]);

  function streamLogs() {
    if (!filePath) {
      return;
    }
    if (streaming) {
      window.ipc.stopTail();
      setStreaming(false);
      setLines([]);
      return;
    }
    try {
      const watcher = new Watcher({
        raidId: history.location.state.raid.id,
        seekFrom: DEBUG ? 0 : new Date().getTime(),
        ...fileInfo,
      });

      watcher.start((line) => {
        setLines([...lines, line]);
        if (!streaming || line === 'START') {
          setStreaming(true);
        }

        if (line === 'STOP') {
          setStreaming(false);
          setLines([]);
        }
      });
    } catch (e) {
      setStreaming(false);
      setLines([]);
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
        filePath={filePath}
        onChange={async (e) => {
          const path = e?.target?.files?.[0]?.path || '';
          setFilePath(path);
          setFileInfo(extractFileInfo(path));
        }}
      />

      <button
        className={`disabled:bg-gray-400 disabled:cursor-not-allowed text-white ${
          streaming ? 'bg-green-500' : 'bg-blue-500'
        }`}
        onClick={streamLogs}
        type="button"
        {...(filePath.length === 0 ? { disabled: true } : {})}
      >
        {streaming ? 'Stop streaming' : 'Start streaming'}
      </button>

      <HistoryLog lines={lines} />
    </div>
  );
};

export default withRouter(FileWatcher);
