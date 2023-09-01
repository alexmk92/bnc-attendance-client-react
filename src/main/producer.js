// import the `Kafka` instance from the kafkajs library
const { Kafka } = require('kafkajs');

// the client ID lets kafka know who's producing the messages
const clientId = 'loot-parser';
// we can define the list of brokers in the cluster
const brokers = ['healthy-stallion-9149-eu1-kafka.upstash.io:9092'];

// initialize a new kafka client and initialize a producer from it
const kafka = new Kafka({
  clientId,
  brokers,
  ssl: true,
  sasl: {
    mechanism: 'scram-sha-256',
    username: 'aGVhbHRoeS1zdGFsbGlvbi05MTQ5JNcSSUXErQ-MU_vaHxsWGQYUpytNdOgPRnk',
    password:
      '1igeUnAVMjXdz-pCnnge2GnxfMXnThXp13trVe63drfvDmtO2iPkLiMTdB6X44hntcd5XQ==',
  },
});

const producer = kafka.producer();

// we define an async function that writes a new message each second
module.exports = async (topic, messages) => {
  console.log('try conn');
  await producer.connect();
  console.log('conn');

  // after the produce has connected, we start an interval timer
  try {
    // send a message to the configured topic with
    // the key and value formed from the current value of `i`
    console.log('sending message', messages);
    await producer.send({
      topic,
      messages,
    });
    return true;
  } catch (err) {
    console.error('could not write message ', err);
    return false;
  }
};
