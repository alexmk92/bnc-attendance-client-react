import 'tailwindcss/tailwind.css';
import { useEffect, useState } from 'react';
import { render } from 'react-dom';

const wrapper = document.getElementById('overlay-root');

function drag(ev: any) {
  const { target } = ev;
  console.log('dragging', target);
  // Save the relative position of the mouse in relation to the element, to make sure
  // we drop it with the right offset at the end.
  const rect = target.getBoundingClientRect();
  ev.dataTransfer.setData('relativeMouseX', ev.clientX - rect.left);
  ev.dataTransfer.setData('relativeMouseY', ev.clientY - rect.top);
  ev.dataTransfer.setData('nodeId', target.id);
}

function drop(ev: any) {
  ev.preventDefault();
  console.log('ev is', ev);
  const relativeMouseX = ev.dataTransfer.getData('relativeMouseX');
  const relativeMouseY = ev.dataTransfer.getData('relativeMouseY');
  const nodeId = ev.dataTransfer.getData('nodeId');

  // Offset the new position based on the relative position of the mouse
  // which we saved on drag start.
  const newTop = ev.clientY - relativeMouseY;
  const newLeft = ev.clientX - relativeMouseX;

  const ele = document.querySelector(`#${nodeId}`) as HTMLElement;

  if (ele) {
    ele.style.top = `${newTop}px`;
    ele.style.left = `${newLeft}px`;
    ele.style.position = 'absolute';
  }
}

function allowDrop(ev: any) {
  ev.preventDefault();
}

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

type LootStatus = 'pending' | 'assigned' | 'passed' | 'looted';

type LootAllocation = {
  player: string;
  lootedItem: string | null;
  rolledAt: number;
  roll: number | 'box';
  lootedAt: number | null;
  status: LootStatus;
};

function setupDraggableElement() {
  const dropSetupAttr = 'dropsetupdone';
  if (wrapper && !wrapper.getAttribute(dropSetupAttr)) {
    wrapper.addEventListener('drop', drop);
    wrapper.addEventListener('dragover', allowDrop);
    wrapper.setAttribute(dropSetupAttr, 'true');
  }
}

interface LootRowProps {
  data: LootAllocation;
  onDelete: () => void;
  // @ts-ignore
  onStatusChanged: (item: LootAllocation, status: LootStatus) => void;
  startTimer: boolean;
}

const MAX_PENDING_COUNTDOWN_TIMER = 60;

function LootRow({
  data,
  onDelete,
  startTimer,
  onStatusChanged,
}: LootRowProps) {
  const { lootedItem, lootedAt, player, roll } = data;
  const [pendingTimer, setPendingTimer] = useState(MAX_PENDING_COUNTDOWN_TIMER);
  const [timerStarted, setTimerStarted] = useState(false);

  const getLootedColor = () => {
    if (!lootedItem) {
      return data.status === 'pending' ? 'text-yellow-500' : 'text-red-500';
    }

    return lootedAt ? 'text-green-500' : 'text-yellow-500';
  };

  useEffect(() => {
    if (pendingTimer === 0 && !data.lootedItem && data.status === 'pending') {
      onStatusChanged(data, 'passed');
    }
  }, [pendingTimer, data, onStatusChanged]);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      if (timerStarted) {
        setPendingTimer((prevTimerCount) => prevTimerCount - 1);
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [timerStarted]);

  useEffect(() => {
    setTimerStarted((prevTimerStarted) => {
      if (startTimer !== prevTimerStarted) {
        return startTimer;
      }

      return prevTimerStarted;
    });
  }, [startTimer]);

  const getCountdownProgress = () => {
    return (pendingTimer / MAX_PENDING_COUNTDOWN_TIMER) * 100;
  };

  const renderTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${`${date.getHours()}`.padStart(
      2,
      '0'
    )}:${`${date.getMinutes()}`.padStart(
      2,
      '0'
    )}:${`${date.getSeconds()}`.padStart(2, '0')}`;
  };

  return (
    <li
      className={`${
        data.status === 'passed' || (!startTimer && data.status !== 'assigned')
          ? 'opacity-80'
          : ''
      } flex flex-grow bg-gray-900 p-2 rounded justify-center text-xs relative items-center`}
    >
      <div className="flex flex-grow flex-col items-start">
        <span className="text-gray-200 capitalize">
          {player} (<span className="text-purple-400">{roll}</span>)
        </span>
        <span
          className={`${
            lootedItem ? 'capitalize' : 'uppercase font-bold'
          } ${getLootedColor()} text-left`}
        >
          {lootedItem ?? `${data.status}`}
        </span>
        <span className="text-xs text-gray-500">
          at {renderTime(data.rolledAt)}
        </span>
      </div>
      <button
        className="w-8 max-h-8 bg-gray-800 px-1 py-1 rounded float-right text-sm  border border-gray-700 hover:bg-gray-700 smooth"
        type="button"
        onClick={onDelete}
      >
        🗑️
      </button>
      {data.status === 'pending' ? (
        <div className="absolute bottom-0 w-full h-1">
          <div
            style={{ width: `${getCountdownProgress()}%` }}
            className="bg-blue-500 absolute bottom-0 h-full z-20 smooth"
          />
          <div className="w-full bg-gray-800 absolute bottom-0 z-10 h-full" />
        </div>
      ) : null}
    </li>
  );
}

function Overlay() {
  const [boxMap, setBoxMap] = useState<{ [boxName: string]: string }>({});
  const [clipboardIcon, setClipboardIcon] = useState('📋');
  const [winner, setWinner] = useState('');
  const [currentRoll, setCurrentRoll] = useState(null);
  const [fetchingRange, setFetchingRange] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [range, setRange] = useState<RangeType>({
    tickets: [],
    rangeString: '',
  });
  const [rollInvocations, setRollInvocations] = useState(0);
  const [lootHistory, setLootHistory] = useState<LootAllocation[]>([]);

  useEffect(() => {
    // @ts-ignore
    const handleBoxMapChanged = (event: any, newBoxMap: string) => {
      setBoxMap(JSON.parse(newBoxMap));
    };

    // @ts-ignore
    const handleRollGenerated = (event: any, rollNumber: any) => {
      setCurrentRoll(rollNumber);
      setRollInvocations((prevRollInvocations) => prevRollInvocations + 1);
    };

    // @ts-ignore
    const handleRangeGenerated = (event: any, newRange: string) => {
      setRange(JSON.parse(newRange));
      setRollInvocations(0);
      setCurrentRoll(null);
      setFetchingRange(false);
      setWinner('');
      setLootHistory([]);
    };

    // @ts-ignore
    const handleItemAssigned = (event: any, item: string) => {
      const itemData = JSON.parse(item);

      setLootHistory((prevHistory) => {
        const newLootHistory = [...prevHistory];
        let pendingLootAllocationIdx = -1;

        if (boxMap[itemData.playerName.toLowerCase().trim()]) {
          itemData.playerName =
            boxMap[itemData.playerName.toLowerCase().trim()];
        }

        for (let i = newLootHistory.length - 1; i >= 0; i--) {
          const lh = newLootHistory[i];
          if (
            lh.player.toLowerCase().trim() ===
              itemData.playerName.toLowerCase().trim() &&
            !lh.lootedItem &&
            lh.status !== 'passed'
          ) {
            pendingLootAllocationIdx = i;
            break;
          }
        }
        console.log('assigned it', pendingLootAllocationIdx, newLootHistory);

        if (pendingLootAllocationIdx >= 0) {
          newLootHistory[pendingLootAllocationIdx] = {
            ...newLootHistory[pendingLootAllocationIdx],
            lootedItem: itemData.itemName,
            lootedAt: null,
            status: 'assigned',
          };
        }

        console.log('setting history to', newLootHistory);
        return newLootHistory;
      });
    };

    // @ts-ignore
    const handleItemLooted = (event: any, item: string) => {
      const itemData = JSON.parse(item);

      setLootHistory((prevHistory) => {
        const newLootHistory = [...prevHistory];
        let pendingLootAllocationIdx = -1;

        if (boxMap[itemData.playerName.toLowerCase().trim()]) {
          itemData.playerName =
            boxMap[itemData.playerName.toLowerCase().trim()];
        }

        for (let i = newLootHistory.length - 1; i >= 0; i--) {
          const lh = newLootHistory[i];
          if (
            lh.player.toLowerCase().trim() ===
              itemData.playerName.toLowerCase().trim() &&
            lh.lootedItem?.toLowerCase().trim() ===
              itemData.itemName.trim().toLowerCase() &&
            !lh.lootedAt &&
            lh.status === 'assigned'
          ) {
            pendingLootAllocationIdx = i;
            break;
          }
        }

        console.log('item data is ', itemData);
        if (
          pendingLootAllocationIdx === -1 &&
          itemData.lootedFrom === 'manually assigned'
        ) {
          for (let i = newLootHistory.length - 1; i >= 0; i--) {
            const lh = newLootHistory[i];
            if (
              lh.player.toLowerCase().trim() ===
                itemData.playerName.toLowerCase().trim() &&
              !lh.lootedItem &&
              lh.status !== 'passed'
            ) {
              pendingLootAllocationIdx = i;
              break;
            }
          }
        }

        if (pendingLootAllocationIdx >= 0) {
          newLootHistory[pendingLootAllocationIdx] = {
            ...newLootHistory[pendingLootAllocationIdx],
            lootedItem: itemData.itemName,
            lootedAt: new Date().getTime(),
            status: 'looted',
          };
        }

        console.log('setting history to', newLootHistory);
        return newLootHistory;
      });
    };

    // @ts-ignore
    const handleFetchRollRange = (event, isFetching) => {
      console.log('fetching is', isFetching);
      setFetchingRange(isFetching);
    };

    // @ts-ignore
    window.electron.onBoxMapChanged(handleBoxMapChanged);
    // @ts-ignore
    window.electron.onRollGenerated(handleRollGenerated);
    // @ts-ignore
    window.electron.onRangeGenerated(handleRangeGenerated);
    // @ts-ignore
    window.electron.onItemAssigned(handleItemAssigned);
    // @ts-ignore
    window.electron.onItemLooted(handleItemLooted);
    // @ts-ignore
    window.electron.onFetchRollRange(handleFetchRollRange);

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
        'item-assigned',
        // @ts-ignore
        window.electron.onItemAssigned
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
  }, []);

  useEffect(() => {
    if (currentRoll !== null && range) {
      const nextWinner = range.tickets?.find(
        (t: any) => currentRoll >= t.lower && currentRoll <= t.upper
      );

      if (nextWinner) {
        setWinner(nextWinner.player.name);
        const pendingLootAllocation: LootAllocation = {
          player: nextWinner.player.name.toLowerCase().trim(),
          roll: currentRoll,
          lootedItem: null,
          lootedAt: null,
          status: 'pending',
          rolledAt: new Date().getTime(),
        };

        setLootHistory((prevHistory) =>
          [pendingLootAllocation, ...prevHistory].slice(0, 25)
        );
      }
    }
  }, [currentRoll, range]);

  useEffect(() => {
    setupDraggableElement();
  }, []);

  const clipboard = () => {
    navigator.clipboard.writeText(range.rangeString);
    setClipboardIcon('✅');
    setTimeout(() => {
      setClipboardIcon('📋');
    }, 250);
  };

  const shouldStartTimer = (idx: number) => {
    const currElement = lootHistory[idx];
    if (!currElement || currElement.status !== 'pending') {
      return false;
    }
    // if im end of list, start timer
    if (idx === lootHistory.length - 1) {
      return true;
    }
    // out of bounds for scanning prev, we always seek from LEN->0
    if (idx + 1 === lootHistory.length) {
      return false;
    }
    const prevElement = lootHistory[idx + 1];
    if (prevElement && prevElement.status !== 'pending') {
      return true;
    }

    return false;
  };

  return (
    <>
      <div
        id="roll-state"
        draggable
        onDragStart={drag}
        className="clickable draggable overlay-node p-2 flex flex-col text-center gap-1 rounded-md border border-gray-800"
        style={{
          backgroundColor: 'rgba(0,0,0,0.85)',
          color: '#fff',
          width: '200px',
          height: '92px',
        }}
      >
        {fetchingRange ? (
          <div className="justify-center flex p-2">
            <svg
              width="57"
              height="57"
              viewBox="0 0 57 57"
              xmlns="http://www.w3.org/2000/svg"
              stroke="#fff"
            >
              <g fill="none" fillRule="evenodd">
                <g transform="translate(1 1)" strokeWidth="2">
                  <circle cx="5" cy="50" r="5">
                    <animate
                      attributeName="cy"
                      begin="0s"
                      dur="2.2s"
                      values="50;5;50;50"
                      calcMode="linear"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="cx"
                      begin="0s"
                      dur="2.2s"
                      values="5;27;49;5"
                      calcMode="linear"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle cx="27" cy="5" r="5">
                    <animate
                      attributeName="cy"
                      begin="0s"
                      dur="2.2s"
                      from="5"
                      to="5"
                      values="5;50;50;5"
                      calcMode="linear"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="cx"
                      begin="0s"
                      dur="2.2s"
                      from="27"
                      to="27"
                      values="27;49;5;27"
                      calcMode="linear"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle cx="49" cy="50" r="5">
                    <animate
                      attributeName="cy"
                      begin="0s"
                      dur="2.2s"
                      values="50;50;5;50"
                      calcMode="linear"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="cx"
                      from="49"
                      to="49"
                      begin="0s"
                      dur="2.2s"
                      values="49;5;27;49"
                      calcMode="linear"
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              </g>
            </svg>
          </div>
        ) : (
          <>
            <span className="text-sm text-gray-300">
              /ran amount:{' '}
              <span className="text-purple-400">
                {range.tickets[range.tickets.length - 1]?.upper}
              </span>
            </span>
            {winner ? (
              <span className="text-gray-300 text-sm">
                <span className="text-green-400">{winner}</span> won with{' '}
                <span className="text-green-400">{currentRoll}</span>
              </span>
            ) : (
              <span className="text-gray-300 text-sm">No winners yet</span>
            )}
            <div className="flex gap-2 items-center">
              <button
                type="button"
                className="bg-gray-800 px-2 py-1 rounded float-right text-sm  border border-gray-700"
                disabled={!range.rangeString}
                onClick={clipboard}
              >
                {range.rangeString ? (
                  <span className="text-xs">
                    {clipboardIcon} copy range (
                    <span className="text-xs">{rollInvocations} rolls</span>)
                  </span>
                ) : (
                  <span className="text-xs">
                    Generate a range in game first
                  </span>
                )}
              </button>
              {range.rangeString ? (
                <button
                  className="bg-gray-800 px-1 py-1 rounded float-right text-sm  border border-gray-700"
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory === false ? '⚔️' : '❌'}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
      {showHistory && range.rangeString ? (
        <div
          id="loot-history"
          draggable
          onDragStart={drag}
          className="clickable draggable overlay-node p-2 flex flex-col text-center gap-1 rounded-md border border-gray-800"
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: '#fff',
            width: '200px',
            height: 'auto',
          }}
        >
          <ul className="flex gap-2 flex-col">
            {lootHistory.map((lh, idx) => (
              <LootRow
                data={lh}
                key={`${lh.player}${lh.rolledAt}${lh.lootedAt}${lh.roll}`}
                onDelete={() => {
                  const prevLootHistory = [...lootHistory];
                  console.log('removing idx', idx);
                  console.log(prevLootHistory);
                  prevLootHistory.splice(idx, 1);
                  console.log(prevLootHistory);
                  setLootHistory(prevLootHistory);
                }}
                startTimer={shouldStartTimer(idx)}
                onStatusChanged={(
                  historyItem: LootAllocation,
                  newStatus: LootStatus
                ) => {
                  const newHistory = [...lootHistory];
                  const index = newHistory.findIndex(
                    (ph) => ph === historyItem
                  );
                  if (index >= 0) {
                    newHistory[index].status = newStatus;
                  }

                  setLootHistory(newHistory);
                }}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

render(<Overlay />, wrapper);
