import { MemoryRouter as Router, Switch, Route } from 'react-router-dom';
import 'tailwindcss/tailwind.css';
import './App.css';
import './set-global';
import FileWatcher from './FileWatcher';
import Raid from './Raid';

export default function App() {
  return (
    <>
      <Router>
        <Switch>
          <Route path="/attendance" component={FileWatcher} />
          <Route path="/" component={Raid} />
        </Switch>
      </Router>
      <span className="fixed bottom-2 right-4 text-sm text-gray-500">
        v0.54
      </span>
    </>
  );
}
