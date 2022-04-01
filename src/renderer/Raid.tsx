import { FC } from 'react';
import { withRouter, useHistory } from 'react-router-dom';
import RaidForm from './components/RaidForm';

const Raid: FC = () => {
  const history = useHistory();

  const updateRaid = (raid: Raid) => {
    history.push('/attendance', { raid });
  };

  return (
    <div>
      <RaidForm onChange={updateRaid} />
    </div>
  );
};

export default withRouter(Raid);
