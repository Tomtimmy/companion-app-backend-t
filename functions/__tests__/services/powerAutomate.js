import { triggerPowerAutomate } from "functions/services/powerAutomate";

import axios from "axios";

export async function triggerPowerAutomate(studentId, action) {
  return axios.post("https://mock-power-automate.com/webhook", {
    studentId,
    action,
  });
}
