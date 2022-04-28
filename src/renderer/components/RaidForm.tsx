import { FC, FormEvent, useState } from 'react';

interface RaidFormProps {
  onChange: (raid: Raid) => void;
}

const RaidForm: FC<RaidFormProps> = ({ onChange }) => {
  const [raidName, setRaidName] = useState<string>('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${window.ipc.baseUrl}/raid`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = () => {
      onChange(JSON.parse(xhr.responseText) as Raid);
    };
    xhr.onerror = (err) => {
      console.error(err);
    };

    xhr.send(JSON.stringify({ name: raidName, split: 1 }));
  };
  return (
    <form
      className="rounded-md flex flex-col gap-3 w-96 px-6 py-6 bg-gradient-to-b from-gray-800 to-slate-900"
      onSubmit={handleSubmit}
      method="POST"
    >
      <h1>Begin raid</h1>
      <input
        className="text-black p-3 rounded bg-gray-900 text-white border-gray-700 border"
        onChange={(e) => setRaidName(e.target.value)}
        type="text"
        name="name"
        placeholder="Raid name"
      />
      {/* <select
        className="text-black p-3 rounded bg-gray-900 text-white border-gray-700 border"
        onChange={(e) => setSplit(e.target.value)}
        name="split"
      >
        <option value="1">Split 1</option>
        <option value="2">Split 2</option>
      </select> */}
      <button className="bg-blue-500 text-white" type="submit">
        Save
      </button>
    </form>
  );
};

export default RaidForm;
