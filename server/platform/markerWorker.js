// Pri Learning — the marker worker thread (entry file of markerPool.js).
//
// Imports the deterministic engine once, then serves marking operations until
// it is told to stop or is terminated at a deadline. It holds no database
// handle, no session and no secret: everything it knows arrives in a message.
import { parentPort } from 'node:worker_threads';
import { serveMarker } from './markerOps.js';

serveMarker(parentPort);
