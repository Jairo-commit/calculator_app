import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { delay, http, HttpResponse, type HttpResponseResolver } from "msw";
import { apiClient } from "./api/client";
import { DIVIDE_BY_ZERO, OPERATION_URL } from "./mocks/handlers";
import { server } from "./mocks/node";
import { recordRequests } from "./test/requests";
import { theme } from "./theme";

function renderApp() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  const panel = screen.getByRole("group", { name: "Calculator" });
  return {
    user,
    panel,
    value: () => screen.getByTestId("value"),
    pending: () => screen.getByTestId("pending"),
    click: async (...names: string[]) => {
      for (const name of names) {
        await user.click(within(panel).getByRole("button", { name }));
      }
    },
  };
}

function holdResponses() {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  server.use(
    http.post(OPERATION_URL, async () => {
      await released;
    }),
  );
  return async () => {
    const answered = new Promise<void>((resolve) =>
      server.events.on("response:mocked", () => resolve()),
    );
    release();
    await answered;
  };
}

const networkError: HttpResponseResolver = () => HttpResponse.error();

const serverError: HttpResponseResolver = () =>
  HttpResponse.json({ error: "Internal server error" }, { status: 500 });

const neverAnswers: HttpResponseResolver = async () => {
  await delay("infinite");
};

const shows = (element: HTMLElement, text: string) =>
  expect(element.textContent).toBe(text);

const SNACKBAR_TEXT = /Couldn't calculate right now/;
const snackbar = () => screen.queryByText(SNACKBAR_TEXT);

type RenderedApp = ReturnType<typeof renderApp>;

async function failTwoPlusThree(
  firstAnswer: HttpResponseResolver = networkError,
) {
  const sentRequests = recordRequests();
  server.use(http.post(OPERATION_URL, firstAnswer, { once: true }));
  const app = renderApp();
  await app.click("2", "Plus", "3", "Equals");
  await screen.findByText(SNACKBAR_TEXT);
  return { app, sentRequests };
}

async function divideOneByZero(app: RenderedApp) {
  await app.click("1", "Divide", "0", "Equals");
  await waitFor(() => shows(app.value(), DIVIDE_BY_ZERO));
}

describe("keypad and keyboard", () => {
  it("sends 2 + 3 = as one add request with both operands", async () => {
    const sentRequests = recordRequests();
    const app = renderApp();

    await app.click("2", "Plus", "3", "Equals");

    await waitFor(() => shows(app.value(), "5"));
    expect(await sentRequests()).toEqual([
      { path: "/api/add", body: { firstOperand: 2, secondOperand: 3 } },
    ]);
  });

  it("shows the pending operation while the second number is typed", async () => {
    const app = renderApp();

    await app.click("2", "Plus", "3");

    shows(app.pending(), "2 +");
  });

  it("shows the finished equation on the pending line after equals", async () => {
    const app = renderApp();

    await app.click("2", "Plus", "3", "Equals");

    await waitFor(() => shows(app.pending(), "2 + 3 ="));
  });

  it("focuses the panel again when the answer arrives", async () => {
    const answer = holdResponses();
    const app = renderApp();
    await app.click("2", "Plus", "3", "Equals");

    await answer();

    await waitFor(() => expect(app.panel).toHaveFocus());
  });

  it("calculates 12 + 30 typed on the physical keyboard", async () => {
    const app = renderApp();

    await app.user.keyboard("12+30{Enter}");

    await waitFor(() => shows(app.value(), "42"));
  });

  it("ignores a digit pressed with Ctrl", async () => {
    const app = renderApp();

    await app.user.keyboard("{Control>}7{/Control}");

    shows(app.value(), "0");
  });

  it("treats Enter as equals when a keypad button has focus", async () => {
    const app = renderApp();
    await app.click("9", "9", "9", "Plus", "1");

    await app.user.keyboard("{Enter}");

    await waitFor(() => shows(app.value(), "1,000"));
  });

  it("sends a result shown with a thousands separator as a plain number", async () => {
    const sentRequests = recordRequests();
    const app = renderApp();
    await app.click("9", "9", "9", "Plus", "1", "Equals");
    await waitFor(() => shows(app.value(), "1,000"));

    await app.click("Plus", "1", "Equals");

    await waitFor(() => shows(app.value(), "1,001"));
    expect((await sentRequests())[1].body).toEqual({
      firstOperand: 1000,
      secondOperand: 1,
    });
  });
});

describe("results the backend sends in exponent form", () => {
  it("shows a tiny result as plain digits", async () => {
    server.use(
      http.post(OPERATION_URL, () => HttpResponse.json({ result: 1e-10 })),
    );
    const app = renderApp();

    await app.click("2", "Plus", "3", "Equals");

    await waitFor(() => shows(app.value(), "0.0000000001"));
  });
});

describe("errors", () => {
  it("shows a 400 error message on the display instead of the snackbar", async () => {
    const app = renderApp();

    await divideOneByZero(app);

    expect(snackbar()).toBeNull();
  });

  it("starts a new number when a digit follows a 400 error", async () => {
    const app = renderApp();
    await divideOneByZero(app);

    await app.click("5");

    shows(app.value(), "5");
  });

  it("keeps the typed number when the server can't be reached", async () => {
    const { app } = await failTwoPlusThree();

    shows(app.value(), "3");
  });

  it("keeps the pending operation when the server can't be reached", async () => {
    const { app } = await failTwoPlusThree();

    shows(app.pending(), "2 +");
  });

  it("opens the snackbar on a 500", async () => {
    await failTwoPlusThree(serverError);

    expect(snackbar()).not.toBeNull();
  });

  it("opens the snackbar when the request times out", async () => {
    apiClient.defaults.timeout = 50;

    await failTwoPlusThree(neverAnswers);

    expect(snackbar()).not.toBeNull();
  });

  it("resends the same operands on Retry", async () => {
    const { app, sentRequests } = await failTwoPlusThree();

    await app.user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => shows(app.value(), "5"));
    expect((await sentRequests()).map((request) => request.body)).toEqual([
      { firstOperand: 2, secondOperand: 3 },
      { firstOperand: 2, secondOperand: 3 },
    ]);
  });

  it.each<[string, (app: RenderedApp) => Promise<void>]>([
    [
      "Retry",
      (app) => app.user.click(screen.getByRole("button", { name: "Retry" })),
    ],
    [
      "Dismiss",
      (app) => app.user.click(screen.getByRole("button", { name: "Dismiss" })),
    ],
    ["a digit", (app) => app.click("4")],
  ])("%s closes the snackbar", async (_closer, close) => {
    const { app } = await failTwoPlusThree();

    await close(app);

    await waitFor(() => expect(snackbar()).toBeNull());
  });

  it.each(["Retry", "Dismiss"])(
    "focuses the panel after %s",
    async (buttonName) => {
      const { app } = await failTwoPlusThree();

      await app.user.click(screen.getByRole("button", { name: buttonName }));

      await waitFor(() => expect(app.panel).toHaveFocus());
    },
  );
});

describe("while a request is pending", () => {
  it("disables every key", async () => {
    holdResponses();
    const app = renderApp();

    await app.click("2", "Plus", "3", "Equals");

    for (const key of within(app.panel).getAllByRole("button")) {
      expect(key).toBeDisabled();
    }
  });

  it("keeps showing every key's label", async () => {
    holdResponses();
    const app = renderApp();

    await app.click("2", "Plus", "3", "Equals");

    expect(
      within(app.panel).getByRole("button", { name: "Equals" }),
    ).toHaveTextContent(/^=$/);
  });

  it("ignores digits typed on the keyboard", async () => {
    holdResponses();
    const app = renderApp();
    await app.user.keyboard("2+3{Enter}");

    await app.user.keyboard("9");

    shows(app.value(), "3");
  });

  it("discards an answer that arrives after Escape", async () => {
    const answer = holdResponses();
    const app = renderApp();
    await app.user.keyboard("2+3{Enter}{Escape}");

    await act(answer);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    shows(app.value(), "0");
  });
});
