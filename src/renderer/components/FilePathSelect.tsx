import { ChangeEventHandler, FC } from 'react';

interface FilePathSelectProps {
  filePath: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

const FilePathSelect: FC<FilePathSelectProps> = ({ filePath, onChange }) => {
  return (
    <form>
      <label htmlFor="file-select" className="my-2">
        <span className="bg-blue-500 px-2 py-1 rounded mr-2">Select File</span>
        <span className="text-sm">{filePath || 'Select file...'}</span>
      </label>
      <input
        id="file-select"
        className="hidden"
        name="file-select"
        onChange={onChange}
        type="file"
      />
    </form>
  );
};

export default FilePathSelect;
