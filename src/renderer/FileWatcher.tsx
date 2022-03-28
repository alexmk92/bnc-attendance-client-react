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
let lines: string[] = [];

const FileWatcher: FC<FileWatcherProps> = ({ history }) => {
  const [filePath, setFilePath] = useState<string>('');
  const [fileInfo, setFileInfo] = useState<FileInfo | undefined>();
  const [streaming, setStreaming] = useState(false);
  const [_rawLines, setLines] = useGlobal('history');

  useEffect(() => {
    console.log(fileInfo);
    window.ipc.stopTail();
    setStreaming(false);
  }, [fileInfo]);

  useEffect(() => {
    if (!streaming) {
      lines = ['Select a file to parse...'];
      setLines(lines);
    }
  }, [streaming]);

  const streamLogs = () => {
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

      setLines([...lines, 'test line ok']);
      watcher.start((line) => {
        console.log('got line', line);
        lines = [...lines, line];
        setLines(lines);
        if (!streaming || line === 'START') {
          setStreaming(true);
        }

        if (line === 'STOP') {
          setStreaming(false);
        }
      });
    } catch (e) {
      setStreaming(false);
    }
  };

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

      <HistoryLog />
    </div>
  );
};

export default withRouter(FileWatcher);
