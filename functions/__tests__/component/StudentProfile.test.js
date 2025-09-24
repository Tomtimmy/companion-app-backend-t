import React from "react";
import { render, screen } from "@testing-library/react";
import StudentProfile from "../../src/components/StudentProfile";

describe("StudentProfile Component", () => {
  it("shows fallback when no student loaded", () => {
    render(<StudentProfile id="123" />);
    expect(screen.getByText("No student loaded")).toBeInTheDocument();
  });
});
