import '../backend/patch_ws.js';
import { createSession } from "@ch99q/twc";

console.log("Starting session test...");
try {
  const session = await createSession();
  console.log("Session connected successfully!");
  process.exit(0);
} catch (e) {
  console.error("Session failed:", e);
  process.exit(1);
}
