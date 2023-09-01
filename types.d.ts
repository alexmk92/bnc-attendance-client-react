import * as fs from 'fs';
import { Message } from 'kafkajs';
import 'reactn';

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
    recordLoot: (lootLines: Message[]) => Promise<number>;
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
    lastRecordedAttendance: Date | null;
    tail: any | undefined;
    attendees: Set<string>;
    lootLines: LootLine[];
    isRecording: boolean;
    fetchingRollRange: boolean;
    isFinalTick: boolean;
    finalTickInitiatedByMe: boolean;
    config: FileWatcherConfig;
    start: (cb: (message: string, data?: {}) => void) => Promise<boolean>;
    stop: () => Promise<void>;
    setRecordAttendanceState: (line: string) => boolean;
    parseAttendanceLine: (
      cb: (message: string, data?: {}) => void,
      line: string
    ) => Promise<void>;
    parseLootLine: (
      cb: (message: string, data?: {}) => void,
      line: string
    ) => Promise<boolean>;
    parseRollRangeLine: (
      cb: (message: string, data?: {}) => void,
      line: string
    ) => Promise<boolean>;
  }

  interface LootLine {
    playerName: string;
    itemName: string;
    quantity?: number;
    lootedFrom?: string;
    wasAssigned: boolean;
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
    requestRollRange: (playerNames: string[]) => Promise<{}>;
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

declare module 'reactn/default' {
  export interface Reducers {
    append: (
      global: State,
      dispatch: Dispatch,
      ...strings: any[]
    ) => Pick<State, 'value'>;

    increment: (
      global: State,
      dispatch: Dispatch,
      i: number
    ) => Pick<State, 'count'>;

    doNothing: (global: State, dispatch: Dispatch) => null;
  }

  export interface State {
    count: number;
    value: string;
    history: { line: string; date: string }[];
  }
}
