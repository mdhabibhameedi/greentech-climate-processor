// Simple load test: sends 50 requests, 10 at a time, to each endpoint.
// Put your own URLs below, then run:  node loadtest.js
const targets = {
  AWS:   'PASTE_YOUR_AWS_FUNCTION_URL/?city=Abha',
  Azure: 'PASTE_YOUR_AZURE_URL/api/climateFunction?city=Abha'
};
const TOTAL = 50, CONCURRENCY = 10;

async function run(name, url) {
  const times = []; let errors = 0, next = 0;
  async function worker() {
    while (next < TOTAL) {
      next++;
      const t = Date.now();
      try {
        const r = await fetch(url);
        await r.text();
        if (!r.ok) errors++;
      } catch (e) { errors++; }
      times.push(Date.now() - t);
    }
  }
  const start = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const total = Date.now() - start;
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`\n${name}`);
  console.log(`Requests: ${TOTAL}, concurrency: ${CONCURRENCY}`);
  console.log(`Average: ${avg.toFixed(0)} ms`);
  console.log(`Fastest: ${times[0]} ms, Slowest: ${times[times.length - 1]} ms`);
  console.log(`Median: ${times[Math.floor(times.length / 2)]} ms`);
  console.log(`Errors: ${errors}`);
  console.log(`Total time: ${(total / 1000).toFixed(1)} s`);
}

(async () => {
  for (const [name, url] of Object.entries(targets)) await run(name, url);
})();
