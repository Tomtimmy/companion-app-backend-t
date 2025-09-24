// functions/__tests__/integration/powerAutomate.test.js

import axios from "axios";
// CORRECTED IMPORT using moduleNameMapper alias
import { triggerPowerAutomate } from "functions/services/powerAutomate";

jest.mock("axios");

describe("Integration: Power Automate Flow", () => {
  it("should mock a Power Automate webhook call", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { success: true },
    });

    const response = await triggerPowerAutomate("12345", "enroll");

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
  });
});