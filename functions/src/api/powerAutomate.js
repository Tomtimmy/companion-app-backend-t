// src/api/powerAutomate.js
import axios from 'axios';

export async function triggerPowerAutomate(payload) {
  const url = process.env.POWER_AUTOMATE_URL || 'https://example-powerautomate.com/trigger';
  const res = await axios.post(url, payload);
  return res.data;
}
