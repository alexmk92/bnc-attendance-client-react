import { MemoryRouter as Router, Switch, Route } from 'react-router-dom';
import 'tailwindcss/tailwind.css';
import './App.css';
import './set-global';
import FileWatcher from './FileWatcher';
import Raid from './Raid';
import { useEffect, useState } from 'react';

export default function App() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // @ts-ignore
    window.electron.send('app_version');
    // @ts-ignore
    window.electron.onAppVersionChanged((e, v) => {
      console.log('got version', v);
      setVersion(v);
    });
  }, []);
  return (
    <>
      <Router>
        <Switch>
          <Route path="/attendance" component={FileWatcher} />
          <Route path="/" component={Raid} />
        </Switch>
      </Router>
      <span className="fixed bottom-2 right-4 text-sm text-gray-500">
        {version}
      </span>
    </>
  );
}
