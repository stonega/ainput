import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Popup } from "../popup";

const query = jest.fn();
const sendMessage = jest.fn();
const createTab = jest.fn();
const storageGet = jest.fn();
const storageSet = jest.fn();
const openOptionsPage = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();

  query.mockImplementation((_queryInfo, callback) => {
    callback([{ id: 1, url: "https://www.example.com/path" }]);
  });
  storageGet.mockImplementation((_keys, callback) => {
    callback({ disabledSites: [] });
  });
  storageSet.mockImplementation((_items, callback) => callback?.());

  global.chrome = {
    tabs: {
      query,
      sendMessage,
      create: createTab,
    },
    storage: {
      sync: {
        get: storageGet,
        set: storageSet,
      },
    },
    runtime: {
      lastError: null,
      openOptionsPage,
    },
  } as any;
});

describe("Popup", () => {
  test("shows the current site and its AInput status", () => {
    render(<Popup />);

    expect(screen.getByText("AINPUT")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("Active on this site")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  test("does not render or load the Auto-Reply site toggle", () => {
    render(<Popup />);

    expect(screen.queryByText(/auto-reply/i)).not.toBeInTheDocument();
    expect(storageGet).toHaveBeenCalledWith(
      ["disabledSites"],
      expect.any(Function)
    );
  });

  test("disables AInput for the current site", () => {
    render(<Popup />);

    fireEvent.click(screen.getByRole("switch"));

    expect(storageSet).toHaveBeenCalledWith(
      { disabledSites: ["https://www.example.com"] },
      expect.any(Function)
    );
    expect(sendMessage).toHaveBeenCalledWith(1, {
      action: "setExtensionEnabled",
      enabled: false,
    });
    expect(screen.getByText("Paused on this site")).toBeInTheDocument();
  });
});
