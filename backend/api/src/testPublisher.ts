import mqtt from 'mqtt';

// Test publisher — simulates a real sensor feeding readings over MQTT so
// tonight's build (persistence, trend projection, alert pipeline, webhook,
// bad-actor ranking) can actually fire end-to-end instead of just compiling.
//
// Targets SEN-SEG-021-pressure_transmitter specifically: SEG-021 is the
// only asset with real cost data, so it's the only one that can pass the
// ROI filter and actually produce an alert.
//
// NOTE: readings publish only ~300ms apart, all within seconds of real
// time — not realistic sensor spacing. The trend projection will produce
// an extreme-looking "hours until crossing" number as a result (extrapolating
// a few seconds of change out to an hourly rate). That's expected and
// honest given the input — it's real math on real data, just synthetic,
// rapid-fire data. Real vendor data spread over actual hours/days will
// produce sane projections.

const SENSOR_ID = 'SEN-SEG-021-pressure_transmitter';
const client = mqtt.connect('mqtt://localhost:1883');

function publish(value: number): void {
  client.publish(
    `sensors/${SENSOR_ID}/reading`,
    JSON.stringify({ value, timestamp: new Date().toISOString() }),
  );
  console.log(`published ${SENSOR_ID} = ${value}`);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

client.on('connect', async () => {
  console.log('connected to broker — publishing 25 trend-building readings...');

  // Trending downward from 900 toward (but not past) hard_min=700, so
  // there's a real, consistent slope for trend projection to compute.
  for (let i = 0; i < 25; i++) {
    publish(900 - i * 5);
    await wait(300);
  }

  console.log('now publishing 2 consecutive breach readings below hard_min=700...');
  publish(650);
  await wait(300);
  publish(640);
  await wait(1000); // give the server time to process before disconnecting

  console.log('done — check server logs for a NEW alert line.');
  client.end();
  process.exit(0);
});

client.on('error', (err) => {
  console.error('publisher connection error:', err.message);
});
