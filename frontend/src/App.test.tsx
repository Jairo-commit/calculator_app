import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import App from "./App";
import { HISTORY_KEY } from "./lib/history";
import {
  DIVIDE_BY_ZERO,
  bodyOf,
  fail,
  fakeBackend,
  reply,
  stubBackend,
  type Adapter,
} from "./test/backend";
import { setViewportWidth } from "./test/setup";

function renderApp() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>,
  );
  const panel = screen.getByRole("group", { name: "Calculator" });
  return {
    user,
    panel,
    value: () => screen.getByTestId("value"),
    pending: () => screen.getByTestId("pending"),
    /** Clicks keypad keys by accessible name. */
    click: async (...names: string[]) => {
      for (const name of names) {
        await user.click(within(panel).getByRole("button", { name }));
      }
    },
  };
}

/** A backend that fails the first request with `adapter`, then works. */
const failingOnce = (adapter: Adapter): Adapter => {
  let calls = 0;
  return (config) => (calls++ === 0 ? adapter(config) : fakeBackend(config));
};

/** A backend that holds every request until `answer()` is called. */
function heldBackend() {
  let answer!: () => void;
  const adapter = stubBackend(
    (c) => new Promise((resolve) => (answer = () => resolve(fakeBackend(c)))),
  );
  return { adapter, answer: () => answer() };
}

/** The display shows exactly `text` (toHaveTextContent alone matches substrings). */
const shows = (el: HTMLElement, text: string) =>
  expect(el).toHaveTextContent(new RegExp(`^${text}$`));

const snackbar = () => screen.queryByText(/Couldn't reach the server/);

describe("keypad and keyboard", () => {
  it("calculates 2 + 3 = with one request, shows the pending line and refocuses the panel", async () => {
    const { adapter: backend, answer } = heldBackend();
    const app = renderApp();

    await app.click("2", "Plus", "3");
    expect(app.pending()).toHaveTextContent("2 +");
    await app.click("Equals");
    answer();

    await waitFor(() => shows(app.value(), "5"));
    expect(app.pending()).toHaveTextContent("2 + 3 =");
    expect(backend).toHaveBeenCalledTimes(1);
    expect(backend.mock.calls[0][0].url).toBe("/add");
    expect(bodyOf(backend.mock.calls[0][0])).toEqual({ a: 2, b: 3 });
    await waitFor(() => expect(app.panel).toHaveFocus());
  });

  it("takes the physical keyboard, ignoring Ctrl combos", async () => {
    stubBackend();
    const app = renderApp();

    await app.user.keyboard("12+30{Enter}");
    await waitFor(() => shows(app.value(), "42"));
    await app.user.keyboard("{Control>}7{/Control}");
    shows(app.value(), "42");
    await app.user.keyboard("{Escape}");

    shows(app.value(), "0");
  });

  it("treats Enter as = and sends a grouped result as a number", async () => {
    const backend = stubBackend();
    const app = renderApp();

    await app.click("9", "9", "9", "Plus", "1");
    await app.user.keyboard("{Enter}");
    await waitFor(() => shows(app.value(), "1,000"));
    await app.click("Plus", "1");
    await app.user.keyboard("{Enter}");

    await waitFor(() => shows(app.value(), "1,001"));
    expect(backend.mock.calls.map(([c]) => bodyOf(c))).toEqual([
      { a: 999, b: 1 },
      { a: 1000, b: 1 },
    ]);
  });
});

describe("errors", () => {
  it("shows a 400 message on the display and recovers with a digit", async () => {
    stubBackend();
    const app = renderApp();

    await app.click("1", "Divide", "0", "Equals");
    await waitFor(() => shows(app.value(), DIVIDE_BY_ZERO));
    expect(snackbar()).toBeNull();
    await app.click("5");

    shows(app.value(), "5");
  });

  it("keeps state on a network failure and Retry re-sends the same operands", async () => {
    const backend = stubBackend(failingOnce(fail(AxiosError.ERR_NETWORK)));
    const app = renderApp();

    await app.click("2", "Plus", "3", "Equals");
    await screen.findByText(/Couldn't reach the server/);
    shows(app.value(), "3");
    expect(app.pending()).toHaveTextContent("2 +");
    await app.user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => shows(app.value(), "5"));
    expect(backend.mock.calls.map(([c]) => bodyOf(c))).toEqual([
      { a: 2, b: 3 },
      { a: 2, b: 3 },
    ]);
    await waitFor(() => expect(snackbar()).toBeNull());
    expect(app.panel).toHaveFocus();
  });

  it("opens the snackbar for a timeout or 5xx; a key or Dismiss closes it", async () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ expr: "2 + 3", result: 5 }]),
    );
    stubBackend(failingOnce((c) => reply(c, 500, {})));
    const app = renderApp();

    await app.click("2", "Plus", "3", "Equals");
    await screen.findByText(/Couldn't reach the server/);
    await app.click("4");
    await waitFor(() => expect(snackbar()).toBeNull());

    stubBackend(fail(AxiosError.ECONNABORTED));
    await app.click("Equals");
    await screen.findByText(/Couldn't reach the server/);
    await app.user.click(screen.getByRole("button", { name: /Reuse 2 \+ 3/ }));
    await waitFor(() => expect(snackbar()).toBeNull());

    await app.click("Equals");
    await screen.findByText(/Couldn't reach the server/);
    await app.user.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(snackbar()).toBeNull());
    expect(app.panel).toHaveFocus();
  });

  it("ignores keys while pending and C discards the late answer", async () => {
    const { adapter: backend, answer } = heldBackend();
    const app = renderApp();

    await app.click("2", "Plus", "3", "Equals");
    await app.click("9");
    shows(app.value(), "3");
    expect(screen.getByRole("button", { name: "Equals" })).toBeDisabled();
    await app.click("Clear");
    answer();
    await act(() => new Promise((r) => setTimeout(r)));

    expect(backend).toHaveBeenCalledTimes(1);
    shows(app.value(), "0");
    expect(localStorage.getItem(HISTORY_KEY)).toBe("[]");
  });
});

describe("history", () => {
  const historyButton = (name: RegExp | string) =>
    within(screen.getByRole("region", { name: "History" })).getByRole(
      "button",
      {
        name,
      },
    );

  it("is saved, loads a result when clicked, is disabled while loading and can be cleared", async () => {
    const { answer } = heldBackend();
    const app = renderApp();

    await app.click("2", "Plus", "3", "Equals");
    expect(
      screen.queryByText("No calculations yet", { exact: false }),
    ).not.toBeNull();
    answer();
    await waitFor(() => shows(app.value(), "5"));
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toEqual([
      { expr: "2 + 3", result: 5 },
    ]);

    await app.click("Plus", "1", "Equals");
    expect(historyButton(/Reuse 2 \+ 3/)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    answer();
    await waitFor(() =>
      expect(historyButton(/Reuse 2 \+ 3/)).not.toHaveAttribute(
        "aria-disabled",
      ),
    );

    await app.user.click(historyButton(/Reuse 2 \+ 3/));
    shows(app.value(), "5");
    expect(app.panel).toHaveFocus();
    await app.user.click(historyButton("Clear"));
    expect(screen.queryByRole("button", { name: /Reuse/ })).toBeNull();
    expect(app.panel).toHaveFocus();
  });

  it("is a drawer below 900px, and reusing an entry closes it and focuses the panel", async () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ expr: "2 + 3", result: 5 }]),
    );
    setViewportWidth(390);
    const app = renderApp();

    expect(screen.queryByText("History")).toBeNull();
    await app.user.click(screen.getByRole("button", { name: "Open history" }));
    await app.user.click(
      await screen.findByRole("button", { name: /Reuse 2 \+ 3/ }),
    );

    await waitFor(() => expect(screen.queryByText("History")).toBeNull());
    shows(app.value(), "5");
    await waitFor(() => expect(app.panel).toHaveFocus());
  });
});
