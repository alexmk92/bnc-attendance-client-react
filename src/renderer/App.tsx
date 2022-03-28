import { MemoryRouter as Router, Switch, Route } from 'react-router-dom';
import 'tailwindcss/tailwind.css';
import './App.css';
import './set-global';
import FileWatcher from './FileWatcher';
import Raid from './Raid';

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/attendance" component={FileWatcher} />
        <Route path="/" component={Raid} />
      </Switch>
    </Router>
  );
}
