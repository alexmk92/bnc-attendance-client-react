export const prettyDate = (time: string | number) => {
  const local = new Date();
  let systemDate = null;
  if (typeof time === 'number') {
    systemDate = time;
  } else {
    systemDate = Date.parse(time);
  }
  const diff = Math.floor((local.getTime() - systemDate) / 1000);

  if (diff <= 1) {
    return 'just now';
  }
  if (diff < 60) {
    return `${diff} seconds ago`;
  }
  if (diff <= 90) {
    return 'one minute ago';
  }
  if (diff <= 3540) {
    return `${Math.round(diff / 60)} minutes ago`;
  }
  if (diff <= 5400) {
    return '1 hour ago';
  }
  if (diff <= 86400) {
    return `${Math.round(diff / 3600)} hours ago`;
  }
  if (diff <= 129600) {
    return '1 day ago';
  }

  return `${systemDate}`;
};

export default prettyDate;
