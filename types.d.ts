import * as fs from 'fs';

export interface BncAPI {
  fileWatcher: (config: FileWatcherConfig) => FileWatcher;
  readdir: (path: string, cb: (err: any, files: string[]) => void) => void;
  raidId: string;
  baseUrl: string;
  currentFile: string;
  readPosition: { [fileName: string]: number };
  setReadPosition: (fileName: string, position: number) => void;
}
declare global {
  interface IpcAPI {
    send: (message: string, data: any) => void;
    setTitle: (title: string) => void;
    loadPreferences: () => Promise<void>;
    getPartial: (partialName: string) => Promise<string>;
    tail: Promise<string>;
    stopTail: () => Promise<void>;
    readdir: typeof fs.promises.readdir;
    baseUrl: string;
  }

  interface Window {
    ipc: IpcAPI;
  }

  interface FileWatcherConfig {
    raidId?: string;
    filePath?: string;
    batchSize?: number;
    seekFrom?: number;
    characterName?: string;
    serverName?: string;
    currentFile?: string;
  }

  interface FileWatcherConstructor {
    new (config: FileWatcherConfig): FileWatcher;
  }

  interface FileWatcher {
    tail: any | undefined;
    attendees: string[];
    playerIds: { [key: string]: string };
    isRecording: boolean;
    isFinalTick: boolean;
    config: FileWatcherConfig;
    start: (cb: (message: string, data?: {}) => void) => Promise<boolean>;
    stop: () => Promise<void>;
    setRecordAttendanceState: (line: string) => boolean;
  }

  // API types
  interface BncHttpApi {
    fetchPlayerIds: (
      playerNames: string[]
    ) => Promise<{ [key: string]: string }>;
    recordAttendance: (
      raidId: string,
      playerNames: string[],
      isFinalTick: boolean
    ) => Promise<boolean>;
    startLotto: (raidId: number, playerIds: string[]) => Promise<boolean>;
    requestRollRange: (raidId: number, lottoId: number) => Promise<string>;
    fetchMains: () => Promise<{ [key: string]: string }>;
  }

  interface HTMLEvent<T extends EventTarget> extends Omit<Event, 'target'> {
    target: T;
  }

  interface Raid {
    id: string;
    name: string;
  }
}