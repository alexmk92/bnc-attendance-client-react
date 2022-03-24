import { ChangeEventHandler, FC } from 'react';

interface FilePathSelectProps {
  filePath: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

const FilePathSelect: FC<FilePathSelectProps> = ({ filePath, onChange }) => {
  return (
    <div>
      <input
        onChange={onChange}
        type="file"
        placeholder={`${filePath || 'File path...'}`}
      />
    </div>
  );
};

export default FilePathSelect;
