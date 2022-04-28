import API from './api';

let lastRecordedLoot: Date | null = null;
let lastRecordedAttendance: Date | null = null;
let recordingAttendance = false;
let recordingLoot = false;

const expressions = {
  RECORD_FINAL_TICK: /RECORDING FINAL TICK/gi,
  START_RECORD_ATTENDANCE: /(Players in EverQuest:)/gi,
  END_RECORD_ATTENDANCE: /(There (are|is) ([0-9]+) player(s)? in EverQuest.)/gi,
  LOOT_LINE:
    /([a-z]+) (has|have) looted (a|an|[0-9]+) ([a-z `']+) from ([a-z `'-]+) corpse./gi,
};

const diffInSeconds = (a: Date, b: Date) => {
  const diff = a.getTime() - b.getTime();
  console.log('sec diff is', diff / 1000);
  return diff / 1000;
};

const attemptToPushLootLines = async (
  raidId: number,
  lootLines: LootLine[],
  cb: (res: number) => void
) => {
  if (
    (!lastRecordedLoot || diffInSeconds(new Date(), lastRecordedLoot) > 10) &&
    !recordingLoot
  ) {
    recordingLoot = true;
    const res = await API.recordLoot(raidId, lootLines);
    recordingLoot = false;
    lastRecordedLoot = new Date();
    cb(res);
  }
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

const extractLootInfo = (
  line: string,
  logPlayerName: string
): LootLine | false => {
  const regExp = new RegExp(expressions.LOOT_LINE);
  const matches = regExp.exec(line);
  if (!matches) {
    return false;
  }

  console.log('WAS A LOOT LINE', matches);
  // @ts-ignore
  let [fullLine, playerName, hasOrHave, qty, itemName, lootedFrom] = matches;
  if (!playerName && !itemName) {
    return false;
  }

  if (playerName.toLowerCase().trim() === 'you') {
    playerName = logPlayerName.toLowerCase().trim();
  }

  return {
    itemName: itemName.toLowerCase().trim(),
    playerName: playerName.toLowerCase().trim(),
    quantity: parseInt(`${qty ?? 1}`, 10) || 1,
    lootedFrom: lootedFrom?.toLowerCase().trim(),
  };
};

const FileWatcher = function FileWatcher(
  this: FileWatcher,
  config: FileWatcherConfig
) {
  this.tail = undefined;
  this.attendees = new Set<string>();
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

        this.parseAttendanceLine(cb, line);
        this.parseLootLine(cb, line);

        if (this.lootLines.length > 0) {
          attemptToPushLootLines(
            // @ts-ignore
            this.config.raidId,
            this.lootLines,
            (res: number) => {
              cb(
                `Pushed ${res}/${this.lootLines.length} loot lines, next batch in 30s`
              );
              this.lootLines = [];
            }
          );
        }

        this.config.seekFrom = timestamp;
      }
    );

    return true;
  };

  this.parseLootLine = async (cb, line) => {
    const raidId = this.config.raidId as unknown as number | null;
    if (!raidId) {
      console.log('no loto');
      return false;
    }

    const lootInfo = extractLootInfo(line, this.config.characterName || '');
    if (!lootInfo) {
      console.log('no info', line);
      return false;
    }

    let { playerName, itemName, quantity, lootedFrom } = lootInfo;
    if (!playerName || !itemName) {
      return false;
    }

    lootedFrom =
      lootedFrom?.toLowerCase().trim().replace('`s', '').replace(`'s`, '') ||
      undefined;

    this.lootLines.push({
      playerName: playerName.toLowerCase().trim(),
      itemName: itemName.toLowerCase().trim(),
      quantity,
      lootedFrom,
    });

    cb(
      `${playerName} looted ${quantity}x ${itemName} from ${lootedFrom}'s corpse`
    );

    return true;
  };

  this.parseAttendanceLine = async (cb, line) => {
    const recordAttendanceIteration = this.setRecordAttendanceState(line);
    console.log('iteration', recordAttendanceIteration);
    if (recordAttendanceIteration) {
      if (this.isRecording) {
        // Later lets extract zone info so we can check if the player is in the raid
        const player = extractAttendanceInfo(line);
        if (player) {
          this.attendees.add(player.trim().toLowerCase());
        }
      } else if (this.attendees.size > 0 && this.config.raidId) {
        if (
          (this.isFinalTick ||
            !lastRecordedAttendance ||
            diffInSeconds(new Date(), lastRecordedAttendance) > 10) &&
          !recordingAttendance
        ) {
          recordingAttendance = true;
          const { raidId } = this.config;
          const { attendees, isFinalTick } = this;
          await API.recordAttendance(
            raidId,
            Array.from(attendees),
            isFinalTick
          );
          cb(
            `Recorded tick for ${this.attendees.size} players`,
            this.attendees
          );
          this.isFinalTick = false;
          this.attendees = new Set<string>();
          lastRecordedAttendance = new Date();
          recordingAttendance = false;
        }
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
