import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders project title and main buttons", () => {
  render(<App />);
  expect(screen.getByText(/ECE 470 - Group 9/i)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Apply Disturbance/i })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Run Optimization/i })
  ).toBeInTheDocument();
});
