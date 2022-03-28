import API from './api';

const expressions = {
  RECORD_FINAL_TICK: /RECORDING FINAL TICK/gi,
  START_RECORD_ATTENDANCE: /(Players in EverQuest:)/gi,
  END_RECORD_ATTENDANCE: /(There (are|is) ([0-9]+) player(s)? in EverQuest.)/gi,
};

const parseTimestamp = (line: string, lastParsedTimestamp: number) => {
  const dateTime = Date.parse(
    line
      .match(/\[[A-Za-z0-9: ]+\]/g)?.[0]
      ?.replace('[', '')
      .replace(']', '') || new Date().toLocaleString()
  );

  // Don't re-parse lines we've already parsed
  return { timestamp: dateTime, shouldParse: dateTime >= lastParsedTimestamp };
};

/**
 * Given a line, extract the players name and the zone so that we can
 * check their attendance.
 *
 * @param line
 * @returns
 */
const extractAttendanceInfo = (line: string) => {
  const regExp = new RegExp(/(\[.+\] ([a-z]+))/gi);
  const matches = regExp.exec(line);

  if (!matches?.[2]) {
    return null;
  }

  return matches[2];
};

const FileWatcher = function FileWatcher(
  this: FileWatcher,
  config: FileWatcherConfig
) {
  this.tail = undefined;
  this.playerIds = {};
  this.attendees = [];
  this.isRecording = false;
  this.isFinalTick = false;
  this.config = {
    raidId: undefined,
    characterName: '',
    serverName: '',
    seekFrom: 0,
    filePath: '',
    currentFile: '',
    ...config,
  };

  /**
   * Sets the global recording state based on whether we are parsing a /who request or not
   * We return true if this was not a line which triggered recording to change
   * or false if recording did change (we don't need to parse player info
   * from a line which caused the recording state to change.)
   *
   * @param line
   * @returns
   */
  this.setRecordAttendanceState = (line: string): boolean => {
    if (line.match(expressions.RECORD_FINAL_TICK)?.length === 1) {
      this.isFinalTick = true;
      return true;
    }
    if (line.match(expressions.START_RECORD_ATTENDANCE)?.length === 1) {
      console.info('Attendance recording started...');
      this.isRecording = true;
      return false;
    }

    if (line.match(expressions.END_RECORD_ATTENDANCE)?.length === 1) {
      console.info('Attendance recording ended...');
      this.isRecording = false;
      return false;
    }

    return true;
  };

  /**
   * Starts tailing the file for this raid.
   */
  this.start = async (cb) => {
    if (!this.config.raidId) {
      throw new Error("Can't start tailing without a raidId");
    }

    cb(
      `processing file: ${this.config.filePath}\\${this.config.currentFile}`,
      {}
    );

    // @ts-ignore
    await window.ipc.tail(
      `${this.config.filePath}\\${this.config.currentFile}`,
      async (line: string) => {
        const { timestamp, shouldParse } = parseTimestamp(
          line,
          this.config.seekFrom as number
        );
        // We don't want to reparse the same lines
        if (!shouldParse) {
          return;
        }

        const recordIteration = this.setRecordAttendanceState(line);
        if (recordIteration) {
          if (this.isRecording) {
            // Later lets extract zone info so we can check if the player is in the raid
            const player = extractAttendanceInfo(line);
            if (player && !this.attendees.includes(player)) {
              this.attendees.push(player.trim().toLowerCase());
            }
          } else {
            if (this.attendees.length > 0) {
              //   const playersWithId = Object.values(this.playerIds);
              //   const playersToFetch = this.attendees.filter(
              //     (player) => playersWithId.includes(player) === false
              //   );
              // this.playerIds = {
              //   ...this.playerIds,
              //   ...(await API.fetchPlayerIds(this.attendees)),
              // };
              if (this.config.raidId) {
                await API.recordAttendance(
                  this.config.raidId,
                  this.attendees,
                  this.isFinalTick
                );
              }
              this.isFinalTick = false;
              cb('recorded tick', this.attendees);
            }
            this.attendees = [];
          }
        }

        this.config.seekFrom = timestamp;
      }
    );

    return true;
  };

  this.stop = async () => {
    this.config.raidId = undefined;
    this.config.seekFrom = 0;
    await window.ipc.stopTail();
  };
} as unknown as FileWatcherConstructor;

export default FileWatcher;
