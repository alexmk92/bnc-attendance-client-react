const axios = require('axios');

const BASE_URL = window.ipc.baseUrl;

export default {
  recordAttendance: async (
    raidId: string,
    playerNames: string[],
    isFinalTick: boolean
  ) => {
    try {
      const res = await axios.post(`${BASE_URL}/raid/tick`, {
        raid_id: raidId,
        player_names: playerNames.map((name) => name.trim().toLowerCase()),
        final_tick: isFinalTick ? 1 : 0,
      });

      if (res.status !== 200) {
        throw new Error('Bad request');
      }

      return res.data;
    } catch (e) {
      return {};
    }
  },
  //   startLotto: async (raidId: number, playerIds: string[]) => {
  //     return true;
  //   },
  requestRollRange: async (playerNames: string[]) => {
    try {
      const playerNameString = playerNames
        .map((name) => name.trim().toLowerCase())
        .join(',');
      const res = await axios.get(
        `${BASE_URL}/raffle/tickets?player_names=${playerNameString}`
      );

      console.log('res is', res);
      if (res.status !== 200) {
        throw new Error('Bad request');
      }

      return res;
    } catch (e) {
      return {};
    }
  },
  //   fetchPlayerIds: async (playerNames: string[]) => {
  //     return {};
  //   },
  fetchMains: async () => {
    return {};
  },
} as BncHttpApi;
