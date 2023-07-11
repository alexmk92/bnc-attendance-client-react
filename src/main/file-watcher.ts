import API from './api';

let lastRecordedAttendance: Date | null = null;
let recordingAttendance = false;

const MANUALLY_ASSIGNED = 'manually assigned';

const pendingLoot: LootLine[] = [];

const expressions = {
  RECORD_FINAL_TICK: /RECORDING FINAL TICK/gi,
  START_RECORD_ATTENDANCE: /(Players in EverQuest:)/gi,
  END_RECORD_ATTENDANCE: /(There (are|is) ([0-9]+) player(s)? in EverQuest.)/gi,
  LOOT_LINE:
    /([a-z]+) (has|have) looted (a|an|[0-9]+) ([a-z `':,-]+) from ([a-z `':,-]+)( corpse)?.?/gi,
  MANUAL_LOOT_LINE: /([a-z]+) LOOT ([a-z '`:,-]+)/gi,
  LOOT_ASSIGNED:
    /(a|an|[0-9]+) ([a-z '`:,-]+) (?:was|were) given to ([a-z]+)/gi,
  START_REQUEST_ROLL_RANGE: /GENERATING LOOT RANGE/gi,
  RANDOM_ROLL_LINE:
    /A Magic Die is rolled by ([A-Za-z]+)\. It could have been any number from ([0-9]+) to ([0-9]+), but this time it turned up a ([0-9]+)/gi,
};

const trimChars = (src: string, c: string) => {
  // @ts-ignore
  const re = new RegExp('^[' + c + ']+|[' + c + ']+$', 'g');
  return src.replace(re, '');
};

// Attempts to parse a manual loot line
const transformManualLootLine = (line: string) => {
  const regExp = new RegExp(expressions.MANUAL_LOOT_LINE);
  const matches = regExp.exec(line);
  if (!matches) {
    return line;
  }

  // @ts-ignore
  const [fullLine, playerName, itemName] = matches;
  if (!playerName && !itemName) {
    return line;
  }

  return `${playerName} has looted a ${itemName} from ${MANUALLY_ASSIGNED}`;
};

const createPendingLootLine = (
  line: string,
  logPlayerName: string
): LootLine | null => {
  const regExp = new RegExp(expressions.LOOT_ASSIGNED);
  const matches = regExp.exec(line);
  if (!matches) {
    return null;
  }

  // @ts-ignore
  const [fullLine, quantity, itemName, playerName] = matches;
  let player = playerName;
  if (player.toLowerCase().trim() === 'you') {
    player = logPlayerName.toLowerCase().trim();
  }

  return {
    itemName: itemName.toLowerCase().trim(),
    playerName: player.toLowerCase().trim(),
    quantity: parseInt(`${quantity ?? 1}`, 10) || 1,
    lootedFrom: MANUALLY_ASSIGNED,
    wasAssigned: true,
  };
};

const diffInSeconds = (a: Date, b: Date) => {
  const diff = a.getTime() - b.getTime();
  console.log('sec diff is', diff / 1000);
  return diff / 1000;
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

const extractRollInfo = (line: string): number | false => {
  const regExp = new RegExp(expressions.RANDOM_ROLL_LINE);
  const matches = regExp.exec(line);
  if (!matches) {
    return false;
  }

  console.log('matches is ', matches);
  const [fullLine, roller, lowerBound, upperBound, rolled] = matches;
  if (!fullLine || !roller || (!lowerBound && !upperBound && !rolled)) {
    return false;
  }

  return parseInt(`${rolled}`, 10);
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
    wasAssigned: false,
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
  this.fetchingRollRange = false;
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

        this.parseRollRangeLine(cb, line);
        this.parseAttendanceLine(cb, line);
        this.parseLootLine(cb, line);

        this.config.seekFrom = timestamp;
      }
    );

    return true;
  };

  // @ts-ignore
  this.parseRollRangeLine = async (cb, rawLine) => {
    if (
      rawLine.match(expressions.START_REQUEST_ROLL_RANGE)?.length === 1 &&
      !this.fetchingRollRange
    ) {
      this.fetchingRollRange = true;
      // @ts-ignore
      window.electron.send('fetching-roll-range', true);
      cb('Starting a new loot range');
      return true;
    }

    const rollInfo = extractRollInfo(rawLine);
    if (rollInfo) {
      console.log('sending roll', rollInfo);
      // @ts-ignore
      await window.electron.send('dice-roll', rollInfo);
      return true;
    }

    return false;
  };

  this.parseLootLine = async (cb, rawLine) => {
    const raidId = this.config.raidId as unknown as number | null;
    if (!raidId) {
      return false;
    }
    // We could have assigned loot
    const potentialPendingLootLine = createPendingLootLine(
      rawLine,
      this.config.characterName || ''
    );
    if (potentialPendingLootLine) {
      pendingLoot.push(potentialPendingLootLine);
      return false;
    }
    // This could either be a line or a transformed line.
    const line = transformManualLootLine(trimChars(rawLine, "'"));

    const lootInfo = extractLootInfo(line, this.config.characterName || '');
    if (!lootInfo) {
      return false;
    }

    const { playerName, itemName, quantity, lootedFrom } = lootInfo;
    if (!playerName || !itemName) {
      return false;
    }

    const fmtLootedFrom =
      lootedFrom
        ?.toLowerCase()
        .trim()
        .replace('`s', '')
        .replace(`'s`, '')
        .replace('corpse', '')
        .replace('.', '') || undefined;

    const pendingItemIndex = pendingLoot.findIndex(
      (l) =>
        l &&
        l?.playerName === playerName &&
        l?.itemName === itemName &&
        l?.wasAssigned === true
    );

    const pendingItem = pendingLoot?.[pendingItemIndex];
    if (pendingItem) {
      delete pendingLoot[pendingItemIndex];
    }

    const message = {
      key: `${raidId}`,
      value: JSON.stringify({
        playerName: playerName.toLowerCase().trim(),
        itemName: itemName.toLowerCase().trim(),
        quantity,
        lootedFrom: fmtLootedFrom,
        wasAssigned:
          pendingItem?.wasAssigned || lootedFrom === MANUALLY_ASSIGNED,
      }),
    };

    if (await window.ipc.recordLoot([message])) {
      const details = JSON.parse(message.value);
      if (
        details.playerName !== 'generating' &&
        details.lootedFrom !== 'manually assigned'
      ) {
        cb(
          `${details.playerName} looted ${details.quantity}x ${details.itemName} from ${details.lootedFrom}`
        );
      }
      return true;
    }

    return false;
  };

  this.parseAttendanceLine = async (cb, line) => {
    const recordAttendanceIteration = this.setRecordAttendanceState(line);
    if (recordAttendanceIteration) {
      if (this.isRecording) {
        // Later lets extract zone info so we can check if the player is in the raid
        const player = extractAttendanceInfo(line);
        if (player) {
          this.attendees.add(player.trim().toLowerCase());
        }
      } else if (this.attendees.size > 0 && this.config.raidId) {
        if (this.fetchingRollRange) {
          try {
            const rollRange = await API.requestRollRange(
              Array.from(this.attendees)
            );
            // @ts-ignore
            cb('Received roll range', rollRange.rangeString);
            console.log('window is', window);

            // @ts-ignore
            await window.electron.send(
              'roll-range',
              // @ts-ignore
              JSON.stringify(rollRange.data)
            );
          } catch (e) {
            console.error('could not poll range', e);
          } finally {
            this.attendees = new Set<string>();
            this.fetchingRollRange = false;
          }
          console.log('fetched roll range');
          return;
        }

        if (
          (this.isFinalTick ||
            !lastRecordedAttendance ||
            diffInSeconds(new Date(), lastRecordedAttendance) > 10) &&
          !recordingAttendance
        ) {
          const { raidId } = this.config;
          const { attendees, isFinalTick } = this;
          recordingAttendance = true;
          await API.recordAttendance(
            raidId,
            Array.from(attendees),
            isFinalTick
          );
          cb(
            `Recorded tick for ${this.attendees.size} players`,
            this.attendees
          );
          lastRecordedAttendance = new Date();
          if (this.isFinalTick) {
            this.isFinalTick = false;
            await this.stop();
            cb('FINAL TICK');
          }
          this.attendees = new Set<string>();
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
