import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { CalcError, evaluate } from "./lib/calculator";
import { setViewportWidth } from "./test/setup";
import { theme } from "./theme";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

/** A fake server that evaluates with the real engine, like the Go backend. */
function fakeServer(init: RequestInit): Response {
  const { expression } = JSON.parse(init.body as string);
  try {
    return json(200, { result: evaluate(expression) });
  } catch (e) {
    if (e instanceof CalcError) return json(400, { error: e.message });
    throw e;
  }
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
    fakeServer(init),
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
    input: () => screen.getByRole("textbox", { name: "Expression" }),
    output: () => screen.getByRole("status"),
    press: async (...labels: string[]) => {
      for (const label of labels) {
        await user.click(screen.getByRole("button", { name: label }));
      }
    },
  };
}

describe("acceptance expressions typed in the field", () => {
  it.each([
    ["(12 + 8) × 3", "60"],
    ["√144 + 2 ^ 3 × 50%", "16"],
    ["2 ^ 3 ^ 2", "512"],
    ["-2 ^ 2", "−4"],
    ["1250 × 15%", "187.5"],
  ])("%s = %s", async (expression, expected) => {
    const app = renderApp();

    await app.user.type(app.input(), `${expression}{Enter}`);

    await waitFor(() =>
      expect(app.output()).toHaveTextContent(`Result${expected}`),
    );
  });
});

describe("keypad", () => {
  it("builds and calculates √144 + 2 ^ 3 × 50%", async () => {
    const app = renderApp();

    await app.press(
      "Square root",
      "1",
      "4",
      "4",
      "Plus",
      "2",
      "Power",
      "3",
      "Multiply",
      "5",
      "0",
      "Percent",
    );
    expect(app.input()).toHaveValue("√144 + 2 ^ 3 × 50%");
    expect(app.output()).toHaveTextContent("Preview16");

    await app.press("Equals");

    await waitFor(() => expect(app.output()).toHaveTextContent("Result16"));
  });

  it("continues from the result: 2 + 3 =, × 2 = gives 10", async () => {
    const app = renderApp();

    await app.press("2", "Plus", "3", "Equals");
    await waitFor(() => expect(app.output()).toHaveTextContent("Result5"));
    await app.press("Multiply", "2");
    expect(app.input()).toHaveValue("5 × 2");
    await app.press("Equals");

    await waitFor(() => expect(app.output()).toHaveTextContent("Result10"));
  });

  it("clears with C and backspaces", async () => {
    const app = renderApp();

    await app.press("1", "2", "Backspace");
    expect(app.input()).toHaveValue("1");
    // The history panel also has a "Clear" button, so find the C key by its text.
    await app.user.click(screen.getByText("C", { selector: "button" }));

    expect(app.input()).toHaveValue("");
    expect(app.output()).toHaveTextContent("Result0");
  });
});

describe("errors", () => {
  it("shows a field error with aria-invalid and sends no request", async () => {
    const app = renderApp();

    await app.user.type(app.input(), "12 + × 4{Enter}");

    expect(app.input()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Two operators in a row")).toBeInTheDocument();
    expect(app.output()).toHaveTextContent("Result—");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the divide by zero message", async () => {
    const app = renderApp();

    await app.user.type(app.input(), "48 ÷ 0{Enter}");

    expect(screen.getByText("Can’t divide by zero")).toBeInTheDocument();
  });

  it("shows a snackbar when the server is down, keeps the input, and retries", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const app = renderApp();

    await app.user.type(app.input(), "2 + 2{Enter}");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Couldn't reach the server. Your input is kept.",
    );
    expect(app.input()).toHaveValue("2 + 2");

    await app.user.click(within(alert).getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(app.output()).toHaveTextContent("Result4"));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });

  it("shows the snackbar on a 500 and can dismiss it", async () => {
    fetchMock.mockResolvedValueOnce(
      json(500, { error: "Internal server error" }),
    );
    const app = renderApp();

    await app.user.type(app.input(), "1 + 1{Enter}");
    const alert = await screen.findByRole("alert");
    await app.user.click(
      within(alert).getByRole("button", { name: "Dismiss" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(app.input()).toHaveValue("1 + 1");
  });
});

describe("keyboard and loading", () => {
  it("clears with Escape", async () => {
    const app = renderApp();
    await app.user.type(app.input(), "12 + 3");

    await app.user.keyboard("{Escape}");

    expect(app.input()).toHaveValue("");
  });

  it("disables = and shows progress while loading", async () => {
    let finish: (r: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => (finish = resolve)),
    );
    const app = renderApp();

    await app.user.type(app.input(), "1 + 1{Enter}");

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

  it("lists a calculation, reuses it, and clears the list", async () => {
    const app = renderApp();
    await app.user.type(app.input(), "(12 + 8) × 3{Enter}");
    const item = await screen.findByRole("button", {
      name: "Reuse (12 + 8) × 3 = 60",
    });

    await app.user.click(app.input());
    await app.user.keyboard("{Escape}");
    await app.user.click(item);

    expect(app.input()).toHaveValue("(12 + 8) × 3");
    expect(app.input()).toHaveFocus();

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

  it("reuses an entry, closes the drawer and focuses the input", async () => {
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
    expect(app.input()).toHaveValue("1 + 2");
    await waitFor(() => expect(app.input()).toHaveFocus());
  });
});
