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
  recordLoot: async (raidId, lootLines) => {
    const loot = lootLines.map(
      ({ playerName, itemName, quantity, lootedFrom }) => {
        return {
          playerName: playerName.trim().toLowerCase(),
          itemName: itemName.trim().toLowerCase(),
          lootedFrom: lootedFrom?.trim().toLowerCase() || null,
          quantity: parseInt(`${quantity}` ?? 1, 10) || 1,
        };
      }
    );

    const res = await axios.post(`${BASE_URL}/raid/${raidId}/loot`, {
      lootLines: loot,
    });
    return res?.data?.data?.loot_recorded || 0;
  },
  //   startLotto: async (raidId: number, playerIds: string[]) => {
  //     return true;
  //   },
  //   requestRollRange: async (raidId: number, lottoId: number) => {
  //     return '1-100';
  //   },
  //   fetchPlayerIds: async (playerNames: string[]) => {
  //     return {};
  //   },
  fetchMains: async () => {
    return {};
  },
} as BncHttpApi;
