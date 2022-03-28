import { setGlobal } from 'reactn';

setGlobal({
  history: [],
  filePath: localStorage.getItem('filePath'),
  currentFile: localStorage.getItem('currentFile'),
  lottos: [],
});
