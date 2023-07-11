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
  ev.dataTransfer.setData('nodeId', 'overlay-node');
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

  const ele = document.querySelector(`.${nodeId}`) as HTMLElement;

  if (ele) {
    ele.style.top = `${newTop}px`;
    ele.style.left = `${newLeft}px`;
    ele.style.position = 'absolute';
  }
}

function allowDrop(ev: any) {
  ev.preventDefault();
}

function setupDraggableElement() {
  const dropSetupAttr = 'dropsetupdone';
  if (wrapper && !wrapper.getAttribute(dropSetupAttr)) {
    wrapper.addEventListener('drop', drop);
    wrapper.addEventListener('dragover', allowDrop);
    wrapper.setAttribute(dropSetupAttr, 'true');
  }
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

setupDraggableElement();

function Overlay() {
  const [lootHistory, setLootHistory] = useState<any[]>([]);
  const [clipboardIcon, setClipboardIcon] = useState('📋');
  const [winner, setWinner] = useState('');
  const [currentRoll, setCurrentRoll] = useState(null);
  const [fetchingRange, setFetchingRange] = useState(false);
  const [range, setRange] = useState<RangeType>({
    tickets: [],
    rangeString: '',
  });
  const [rollInvocations, setRollInvocations] = useState(0);

  useEffect(() => {
    // @ts-ignore
    window.electron.onRollGenerated((event, rollNumber) => {
      setCurrentRoll(rollNumber);
      setRollInvocations(rollInvocations + 1);
    });

    // @ts-ignore
    window.electron.onRangeGenerated((event, range) => {
      setRange(JSON.parse(range));
      setRollInvocations(0);
      setCurrentRoll(null);
      setFetchingRange(false);
      setWinner('');
    });

    // @ts-ignore
    window.electron.onItemLooted((event, item) => {
      const itemData = JSON.parse(item);

      let pendingLootAllocation = lootHistory.find(
        (lh) =>
          lh.player.toLowerCase().trim() ===
            item.playerName.toLowerCase().trim() && !lh.lootedItem
      );

      if (!pendingLootAllocation) {
        pendingLootAllocation = {
          player: item.playerName.toLowerCase().trim(),
          roll: 'box',
          lootedItem: itemData.itemName,
        };
      } else {
        pendingLootAllocation.lootedItem = itemData.name;
      }

      const newLootHistory = [pendingLootAllocation, ...lootHistory].slice(
        0,
        4
      );
      setLootHistory(newLootHistory);
    });

    // @ts-ignore
    window.electron.onFetchRollRange(() => {
      setFetchingRange(true);
    });
  }, [rollInvocations, lootHistory]);

  useEffect(() => {
    if (currentRoll !== null && range) {
      console.log('range is', range, currentRoll);
      // @ts-ignore
      const nextWinner = range.tickets?.find(
        // @ts-ignore
        (t) => currentRoll >= t.lower && currentRoll <= t.upper
      );
      console.log('next winner is', nextWinner);

      if (nextWinner) {
        setWinner(nextWinner.player.name);
        const pendingLootAllocation = {
          player: nextWinner.player.name.toLowerCase().trim(),
          roll: currentRoll,
          lootedItem: null,
        };
        const newLootHistory = [pendingLootAllocation, ...lootHistory].slice(
          0,
          4
        );
        setLootHistory(newLootHistory);
      }
    }
  }, [currentRoll, range, rollInvocations, winner, lootHistory]);

  const clipboard = () => {
    navigator.clipboard.writeText(range.rangeString);
    setClipboardIcon('✅');
    setTimeout(() => {
      setClipboardIcon('📋');
    }, 250);
  };

  return (
    <div
      draggable={true}
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
          <button
            className={`bg-gray-800 px-2 py-1 rounded float-right text-sm  border border-gray-700`}
            disabled={!range.rangeString}
            onClick={clipboard}
          >
            {range.rangeString ? (
              <span className="text-xs">
                {clipboardIcon} copy range (
                <span className="text-xs">{rollInvocations} rolls</span>)
              </span>
            ) : (
              <span className="text-xs">Generate a range in game first</span>
            )}
          </button>
        </>
      )}
      <ul style={{ backgroundColor: 'rgba(0, 0, 0, 0.8' }} className="p-1">
        {lootHistory.map((lh: any, idx: number) => (
          <li
            className={`text-xs ${
              lh.lootedItem ? 'text-green-500' : 'text-red-500'
            }`}
            key={`${lh.itemName}${lh.playerName}${idx}`}
          >
            {lh?.player} ({lh.roll}) {lh?.lootedItem ?? '-- pending --'}
          </li>
        ))}
      </ul>
    </div>
  );
}

render(<Overlay />, wrapper);
