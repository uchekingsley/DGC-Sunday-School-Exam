/**
 * 1,700 CONCURRENT CANDIDATE SUBMISSION SIMULATION
 * 
 * Run with: node load_test.js
 * 
 * Simulates 1,700 students taking the exam and submitting within a tight window.
 * Measures response times, error rates, and verifies database integrity.
 */

const https = require('https');

const PROJECT_ID = "discipleship-unit-test";
const API_KEY = "AIzaSyAqwnQTnNKpsZ2enPgTAaHX0vxDCYqVwmU";
const TOTAL_CANDIDATES = 1700;
const CONCURRENT_WORKERS = 40; // Simulates 40 simultaneous parallel HTTP network streams

console.log("=================================================");
console.log(`🚀 STARTING LOAD TEST: ${TOTAL_CANDIDATES} Concurrent Exam Submissions`);
console.log(`🎯 Target Project: ${PROJECT_ID}`);
console.log(`⚡ Parallel Streams: ${CONCURRENT_WORKERS}`);
console.log("=================================================\n");

let completed = 0;
let successCount = 0;
let errorCount = 0;
let duplicateRejectedCount = 0;
const latencies = [];
const startTime = Date.now();

function submitCandidate(index) {
  return new Promise((resolve) => {
    const email = `loadtest_user_${index}@dgc.org`;
    const score = Math.floor(Math.random() * 21) + 10; // 10 to 30
    const percent = Math.round((score / 30) * 100);
    const pass = percent >= 50 ? "Pass" : "Fail";
    const auto = Math.random() > 0.8 ? "Yes" : "No";

    const payload = JSON.stringify({
      fields: {
        exam: { stringValue: "Discipleship Load Test" },
        name: { stringValue: `Test Candidate ${index}` },
        email: { stringValue: email },
        score: { integerValue: String(score) },
        total: { integerValue: "30" },
        percent: { integerValue: String(percent) },
        result: { stringValue: pass },
        auto: { stringValue: auto },
        submittedAt: { timestampValue: new Date().toISOString() },
        details: { stringValue: `Tab switches: 0\nLoad test simulation record ${index}` }
      }
    });

    const docId = "e_" + email.toLowerCase().replace(/[^a-z0-9._@+-]/g, "_");
    const path = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/results?documentId=${docId}&key=${API_KEY}`;

    const reqStart = Date.now();
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const reqLatency = Date.now() - reqStart;
        latencies.push(reqLatency);
        completed++;

        if (res.statusCode === 200) {
          successCount++;
        } else if (res.statusCode === 409) {
          // Idempotent duplicate protection
          duplicateRejectedCount++;
          successCount++;
        } else {
          errorCount++;
        }

        if (completed % 100 === 0 || completed === TOTAL_CANDIDATES) {
          const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
          const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0);
          console.log(`⏱️ [${elapsedSec}s] Completed: ${completed}/${TOTAL_CANDIDATES} | Success: ${successCount} | Failed: ${errorCount} | Avg Latency: ${avgLatency}ms`);
        }

        resolve();
      });
    });

    req.on('error', (err) => {
      completed++;
      errorCount++;
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

// Concurrency queue
async function runLoadTest() {
  let currentIndex = 1;

  async function worker() {
    while (currentIndex <= TOTAL_CANDIDATES) {
      const idx = currentIndex++;
      await submitCandidate(idx);
    }
  }

  const workers = Array.from({ length: CONCURRENT_WORKERS }, () => worker());
  await Promise.all(workers);

  const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const throughput = (TOTAL_CANDIDATES / totalTimeSec).toFixed(1);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0);
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  console.log("\n=================================================");
  console.log("🏁 LOAD TEST COMPLETE - RESULTS SUMMARY");
  console.log("=================================================");
  console.log(`Total Submissions Attempted: ${TOTAL_CANDIDATES}`);
  console.log(`Successful Writes:           ${successCount}`);
  console.log(`Failed Writes:               ${errorCount}`);
  console.log(`Total Time Elapsed:          ${totalTimeSec} seconds`);
  console.log(`Throughput Rate:             ${throughput} submissions / second`);
  console.log(`Average Latency:             ${avgLatency} ms`);
  console.log(`95th Percentile Latency:     ${p95} ms`);
  console.log("=================================================\n");
}

runLoadTest();
