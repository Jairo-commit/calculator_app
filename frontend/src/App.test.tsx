import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { fakeBackend, json } from "./test/fakeBackend";
import { setViewportWidth } from "./test/setup";
import { theme } from "./theme";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: string, init: RequestInit) =>
    fakeBackend(url, init),
  );
  vi.stubGlobal("fetch", fetchMock);
});

const historyClearButton = () =>
  within(screen.getByRole("region", { name: "History" })).getByRole("button", {
    name: "Clear",
  });

function renderApp() {
  const user = userEvent.setup();
  render(
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>,
  );
  return {
    user,
    calculator: () => screen.getByRole("group", { name: "Calculator" }),
    output: () => screen.getByRole("status"),
    pending: () => screen.getByTestId("pending"),
    press: async (...labels: string[]) => {
      for (const label of labels) {
        // The history panel also has a "Clear" button, so stay on the keypad.
        await user.click(
          within(screen.getByRole("group", { name: "Calculator" })).getByRole(
            "button",
            { name: label },
          ),
        );
      }
    },
  };
}

const expectValue = (app: ReturnType<typeof renderApp>, text: string) =>
  waitFor(() =>
    expect(
      within(app.output()).getByRole("region", { name: "Result value" }),
    ).toHaveTextContent(new RegExp(`^${text}$`)),
  );

describe("keypad", () => {
  it("shows 0 and the keys in the old-calculator layout", () => {
    const app = renderApp();

    expect(app.output()).toHaveTextContent("0");
    const labels = screen
      .getAllByRole("button")
      .filter((b) => app.calculator().contains(b))
      .map((b) => b.textContent);
    expect(labels).toEqual(
      "C CE ⌫ ÷ √ xʸ % × 7 8 9 − 4 5 6 + 1 2 3 = 0 .".split(" "),
    );
  });

  it("2 + 3 = shows 5 and the finished equation", async () => {
    const app = renderApp();

    await app.press("2", "Plus", "3", "Equals");

    await expectValue(app, "5");
    expect(app.pending()).toHaveTextContent("2 + 3 =");
  });

  it("2 + 3 + shows 5 with the pending line 5 +", async () => {
    const app = renderApp();

    await app.press("2", "Plus", "3", "Plus");

    await expectValue(app, "5");
    expect(app.pending()).toHaveTextContent("5 +");
  });

  it("swaps the operator when two signs are pressed in a row", async () => {
    const app = renderApp();

    await app.press("2", "Plus", "Minus", "3", "Equals");

    await expectValue(app, "−1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/subtract");
  });

  it("calculates 9 √ and 80 × 15 % =", async () => {
    const app = renderApp();

    await app.press("9", "Square root");
    await expectValue(app, "3");
    await app.press(
      "Clear",
      "8",
      "0",
      "Multiply",
      "1",
      "5",
      "Percent",
      "Equals",
    );

    await expectValue(app, "12");
  });

  it("removes digits with Backspace and clears the entry with CE", async () => {
    const app = renderApp();

    await app.press("1", "2", "Backspace");
    await expectValue(app, "1");
    await app.press("Plus", "7", "Clear entry");
    await expectValue(app, "0");
    expect(app.pending()).toHaveTextContent("1 +");
  });

  it("shows the server's message in the display, then a digit recovers", async () => {
    const app = renderApp();

    await app.press("1", "Divide", "0", "Equals");

    const value = await screen.findByText("Can’t divide by zero");
    expect(value).toHaveStyle({ color: theme.palette.error.main });
    await app.press("5");
    await expectValue(app, "5");
  });
});

describe("physical keyboard", () => {
  it("focuses the calculator on mount and takes digits and operators", async () => {
    const app = renderApp();
    expect(app.calculator()).toHaveFocus();

    await app.user.keyboard("12+30{Enter}");

    await expectValue(app, "42");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/add");
  });

  it.each([
    ["8*5=", "40"],
    ["9/3{Enter}", "3"],
    ["2^3=", "8"],
    ["81r", "9"],
    ["50%", "0.5"],
    ["7-9=", "−2"],
    ["12{Backspace}", "1"],
  ])("%s gives %s", async (keys, expected) => {
    const app = renderApp();

    await app.user.keyboard(keys);

    await expectValue(app, expected);
  });

  it("Delete clears the entry and Escape clears everything", async () => {
    const app = renderApp();

    await app.user.keyboard("5+9{Delete}");
    await expectValue(app, "0");
    expect(app.pending()).toHaveTextContent("5 +");
    await app.user.keyboard("{Escape}");

    await expectValue(app, "0");
    expect(app.pending()).toHaveTextContent(/^$/);
  });

  it("does not press a focused key twice on Enter", async () => {
    const app = renderApp();
    await app.user.keyboard("2+3");
    screen.getByRole("button", { name: "Equals" }).focus();

    await app.user.keyboard("{Enter}");

    await expectValue(app, "5");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores shortcuts with Ctrl and keys it does not use", async () => {
    const app = renderApp();

    await app.user.keyboard("{Control>}5{/Control}a");

    await expectValue(app, "0");
  });
});

describe("errors and loading", () => {
  it("shows a snackbar when the server is down, keeps the state, and retries", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const app = renderApp();

    await app.press("2", "Plus", "2", "Equals");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Couldn't reach the server. Your input is kept.",
    );
    await expectValue(app, "2");
    expect(app.pending()).toHaveTextContent("2 +");

    await app.user.click(within(alert).getByRole("button", { name: "Retry" }));

    await expectValue(app, "4");
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });

  it("shows the snackbar on a 500 and can dismiss it", async () => {
    fetchMock.mockResolvedValueOnce(
      json(500, { error: "Internal server error" }),
    );
    const app = renderApp();

    await app.press("1", "Plus", "1", "Equals");
    const alert = await screen.findByRole("alert");
    await app.user.click(
      within(alert).getByRole("button", { name: "Dismiss" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    await expectValue(app, "1");
  });

  it("disables = and shows progress while loading", async () => {
    let finish: (r: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => (finish = resolve)),
    );
    const app = renderApp();

    await app.press("1", "Plus", "1", "Equals");

    expect(screen.getByRole("button", { name: "Equals" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Equals" })).toHaveTextContent(
      "Calculating…",
    );
    expect(
      screen.getByRole("progressbar", { name: "Calculating" }),
    ).toBeInTheDocument();

    finish(json(200, { result: 2 }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Equals" })).toBeEnabled(),
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("history on desktop", () => {
  it("shows the empty state with Clear disabled", () => {
    renderApp();

    expect(
      screen.getByText(
        "No calculations yet. Results you calculate will show up here.",
      ),
    ).toBeInTheDocument();
    expect(historyClearButton()).toBeDisabled();
  });

  it("lists a calculation, reuses its result, and clears the list", async () => {
    const app = renderApp();
    await app.press("1", "2", "Multiply", "5", "Equals");
    const item = await screen.findByRole("button", {
      name: "Reuse 12 × 5 = 60",
    });

    await app.press("Clear");
    await app.user.click(item);

    await expectValue(app, "60");
    expect(app.calculator()).toHaveFocus();

    await app.user.click(historyClearButton());
    expect(
      screen.queryByRole("button", { name: /^Reuse/ }),
    ).not.toBeInTheDocument();
  });

  it("has no Open history button", () => {
    renderApp();

    expect(
      screen.queryByRole("button", { name: "Open history" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "History" })).toBeInTheDocument();
  });
});

describe("history on a 390px phone", () => {
  beforeEach(() => setViewportWidth(390));

  it("keeps history in a drawer opened from the app bar", async () => {
    const app = renderApp();
    expect(
      screen.queryByRole("region", { name: "History" }),
    ).not.toBeInTheDocument();

    await app.user.click(screen.getByRole("button", { name: "Open history" }));

    expect(
      await screen.findByRole("region", { name: "History" }),
    ).toBeInTheDocument();
  });

  it("reuses an entry, closes the drawer and focuses the calculator", async () => {
    localStorage.setItem(
      "calculator.history.v1",
      JSON.stringify([{ expr: "1 + 2", result: 3 }]),
    );
    const app = renderApp();

    await app.user.click(screen.getByRole("button", { name: "Open history" }));
    await app.user.click(
      await screen.findByRole("button", { name: "Reuse 1 + 2 = 3" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "History" }),
      ).not.toBeInTheDocument(),
    );
    await expectValue(app, "3");
    await waitFor(() => expect(app.calculator()).toHaveFocus());
  });
});
