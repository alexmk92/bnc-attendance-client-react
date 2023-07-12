import {
  createContext,
  FC,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type LootAllocation = {
  player: string;
  lootedItem: string | null;
  rolledAt: number;
  roll: number;
  lootedAt: number | null;
};

type BoxMap = { [boxName: string]: string };

type RangeType = {
  tickets: Array<{
    player: {
      id: string;
      name: string;
    };
    upper: number;
    lower: number;
  }>;
  rangeString: string;
};

export const OverlayContext = createContext<{
  currentRoll: number | null;
  fetchingRange: boolean;
  range: RangeType;
  rollInvocations: number;
  lootHistory: LootAllocation[];
}>({
  currentRoll: 0,
  fetchingRange: false,
  range: { tickets: [], rangeString: '' },
  rollInvocations: 0,
  lootHistory: [],
});

OverlayContext.displayName = 'Overlay context';

export const OverlayProvider: FC<{ children: ReactNode }> = function ({
  children,
}) {
  const [boxMap, setBoxMap] = useState<BoxMap>({});
  const [currentRoll, setCurrentRoll] = useState(null);
  const [fetchingRange, setFetchingRange] = useState(false);
  const [range, setRange] = useState<RangeType>({
    tickets: [],
    rangeString: '',
  });
  const [rollInvocations, setRollInvocations] = useState(0);
  const [lootHistory, setLootHistory] = useState<LootAllocation[]>([]);

  useEffect(() => {
    setBoxMap({ mave: 'karadin' });
  }, []);

  useEffect(() => {
    console.log('refire event listener');
    // @ts-ignore
    window.electron.onRollGenerated((event, rollNumber) => {
      setCurrentRoll(rollNumber);
      setRollInvocations(rollInvocations + 1);
    });

    // @ts-ignore
    window.electron.onRangeGenerated((event, nextRange) => {
      setRange(JSON.parse(nextRange));
      setRollInvocations(0);
      setCurrentRoll(null);
      setFetchingRange(false);
    });

    // @ts-ignore
    window.electron.onItemLooted((event, item) => {
      const itemData = JSON.parse(item);

      let pendingLootAllocationIdx = -1;
      if (boxMap[itemData.playerName.toLowerCase().trim()]) {
        itemData.playerName = boxMap[itemData.playerName.toLowerCase().trim()];
      }

      // @ts-ignore
      for (let i = 0; i < lootHistory.length; i++) {
        const lh = lootHistory[i];
        if (
          lh.player.toLowerCase().trim() ===
            itemData.playerName.toLowerCase().trim() &&
          !lh.lootedItem
        ) {
          pendingLootAllocationIdx = i;
        }
      }

      if (pendingLootAllocationIdx >= 0) {
        lootHistory[pendingLootAllocationIdx].lootedItem = itemData.itemName;
        lootHistory[pendingLootAllocationIdx].lootedAt = new Date().getTime();
      }

      console.log('new history', lootHistory);
      setLootHistory(lootHistory);
    });

    // @ts-ignore
    window.electron.onFetchRollRange(() => {
      setFetchingRange(true);
    });

    return () => {
      window.removeEventListener(
        'update-current-roll',
        // @ts-ignore
        window.electron.onRollGenerated
      );
      window.removeEventListener(
        'item-looted',
        // @ts-ignore
        window.electron.onItemLooted
      );
      window.removeEventListener(
        'update-roll-range',
        // @ts-ignore
        window.electron.onRangeGenerated
      );
      window.removeEventListener(
        'fetching-roll-range',
        // @ts-ignore
        window.electron.onFetchRollRange
      );
    };
  });

  return useMemo(
    () => (
      <OverlayContext.Provider
        value={{
          lootHistory,
          currentRoll,
          range,
          fetchingRange,
          rollInvocations,
        }}
      >
        {children}
      </OverlayContext.Provider>
    ),
    []
  );
};

export default {};
