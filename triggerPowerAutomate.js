// functions/services/powerAutomate.js
import axios from "axios";

export async function triggerPowerAutomate(studentId, action) {
  try {
    const response = await axios.post("https://mock-flow-url", {
      studentId,
      action,
    });
    return response; // ✅ important
  } catch (err) {
    throw new Error("Flow failed");
  }
}
