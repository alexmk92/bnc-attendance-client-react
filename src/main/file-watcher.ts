import debounce from 'lodash.debounce';
import API from './api';

const expressions = {
  RECORD_FINAL_TICK: /RECORDING FINAL TICK/gi,
  START_RECORD_ATTENDANCE: /(Players in EverQuest:)/gi,
  END_RECORD_ATTENDANCE: /(There (are|is) ([0-9]+) player(s)? in EverQuest.)/gi,
  LOOT_LINE: /([a-z]+) has looted (a|an|[0-9]+) ([a-z `']+) from/gi,
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

const extractLootInfo = (line: string) => {
  const regExp = new RegExp(expressions.LOOT_LINE);
  const matches = regExp.exec(line);
  if (!matches) {
    return false;
  }

  // @ts-ignore
  const [fullLine, playerName, qty, itemName] = matches;
  if (!playerName && !itemName) {
    return false;
  }

  return {
    itemName: itemName.toLowerCase().trim(),
    playerName: playerName.toLowerCase().trim(),
    quantity: parseInt(`${qty ?? 0}`, 10) || 0,
  };
};

/**
 * Only send a request every X seconds
 * @param lastRecordedDate
 * @param resendTime - time in s we can resend
 * @returns
 */
const canRecord = (lastRecordedDate: Date | null, resendTime: number) => {
  if (lastRecordedDate === null) {
    return true;
  }

  const diffInMs = new Date().getTime() - lastRecordedDate.getTime();
  return diffInMs / 1000 > resendTime;
};

const FileWatcher = function FileWatcher(
  this: FileWatcher,
  config: FileWatcherConfig
) {
  this.lastRecordedAttendance = null;
  this.tail = undefined;
  this.playerIds = {};
  this.attendees = [];
  this.lootLines = [];
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
    console.log(line);
    if (line.match(expressions.RECORD_FINAL_TICK)?.length === 1) {
      this.isFinalTick = true;
      console.log('final');
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
    console.log('ehere');
    if (!this.config.raidId) {
      throw new Error("Can't start tailing without a raidId");
    }

    console.log('uh');
    cb(
      `processing file: ${this.config.filePath}\\${this.config.currentFile}`,
      {}
    );

    // @ts-ignore
    await window.ipc.tail(
      `${this.config.filePath}\\${this.config.currentFile}`,
      async (line: string) => {
        console.log(line);
        const { timestamp, shouldParse } = parseTimestamp(
          line,
          this.config.seekFrom as number
        );
        // We don't want to reparse the same lines
        if (!shouldParse) {
          return;
        }

        this.config.seekFrom = timestamp;
      }
    );

    return true;
  };

  this.parseLootLine = async (cb, line) => {
    const raidId = this.config.raidId as unknown as number | null;
    if (!raidId) {
      return false;
    }

    const lootInfo = extractLootInfo(line);
    if (!lootInfo) {
      return false;
    }

    const { playerName, itemName, quantity } = lootInfo;
    if (!playerName || !itemName) {
      return false;
    }

    this.lootLines.push({
      playerName: playerName.toLowerCase().trim(),
      itemName: itemName.toLowerCase().trim(),
      quantity,
    });

    await debounce(async () => {
      const res = await API.recordLoot(raidId, this.lootLines);
      cb(
        `Pushed ${res}/${this.lootLines.length} loot lines, next batch in 30s`
      );
      this.lootLines = [];
    }, 30 * 1000);

    return true;
  };

  this.parseAttendanceLine = async (cb, line) => {
    console.log(line);
    if (!canRecord(this.lastRecordedAttendance, 30)) {
      console.log('no record');
      cb('Attendance can only be sent once every 30 seconds', {});
      return;
    }

    const recordAttendanceIteration = this.setRecordAttendanceState(line);
    console.log(recordAttendanceIteration);
    if (recordAttendanceIteration) {
      if (this.isRecording) {
        // Later lets extract zone info so we can check if the player is in the raid
        const player = extractAttendanceInfo(line);
        if (player && !this.attendees.includes(player)) {
          this.attendees.push(player.trim().toLowerCase());
        }
      } else {
        if (this.attendees.length > 0) {
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
        this.lastRecordedAttendance = new Date();
      }
    }
  };

  this.stop = async () => {
    this.config.raidId = undefined;
    this.config.seekFrom = 0;
    await window.ipc.stopTail();
  };
} as unknown as FileWatcherConstructor;

export default FileWatcher;
