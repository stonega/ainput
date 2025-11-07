import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { Popup } from "../popup";

// Mock chrome APIs
beforeAll(() => {
  global.chrome = {
    tabs: {
      query: jest.fn().mockImplementation((queryInfo, callback) => {
        callback([{ id: 1, url: "https://example.com" }]);
      }),
      sendMessage: jest.fn(),
    },
    storage: {
      sync: {
        get: jest.fn().mockImplementation((keys, callback) => {
          callback({ disabledSites: [] });
        }),
        set: jest.fn(),
      },
    },
    runtime: {
      lastError: null,
    },
  } as any;
});

describe("Popup", () => {
  test("renders the main title", () => {
    render(<Popup />);
    expect(screen.getByText("AINPUT")).toBeInTheDocument();
  });
});
