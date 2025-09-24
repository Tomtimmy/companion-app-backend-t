import axios from "axios";
import { triggerPowerAutomate } from "../../services/powerAutomate";

jest.mock("axios");

describe("Integration: Power Automate Flow", () => {
  it("should mock a Power Automate webhook call", async () => {
    // Mock the axios response
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { success: true },
    });

    const response = await triggerPowerAutomate("12345", "enroll");

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
  });
});
