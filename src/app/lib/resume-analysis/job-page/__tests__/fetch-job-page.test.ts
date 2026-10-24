/**
 * @jest-environment node
 */
import dns from "dns";
import type { AddressInfo } from "net";
import { AiRequestError } from "lib/ai/gemini";
import { DEFAULT_GUARD, fetchJobPage, parseJobUrl, type FetchGuard } from "lib/resume-analysis/job-page/fetch-job-page";

// The test compiler can't resolve Node built-ins by name, so the one we create a server with is loaded like this.
const realHttp = jest.requireActual("http") as typeof import("http");

type Handler = (req: import("http").IncomingMessage, res: import("http").ServerResponse) => void;

let server: import("http").Server;
let port: number;
let handlers: Record<string, Handler> = {};
let requests: string[] = [];

/** Allows only the local test server, on its own port. */
const localGuard = (): FetchGuard => ({ isAllowedAddress: (a) => a === "127.0.0.1", allowedPorts: [port] });
const local = (path: string) => `http://127.0.0.1:${port}${path}`;

beforeAll(async () => {
  server = realHttp.createServer((req, res) => {
    requests.push(`${req.method} ${req.url} ${req.headers["accept-encoding"]}`);
    const handler = handlers[req.url ?? ""];
    if (handler) return handler(req, res);
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections(); // so a test that leaves a connection open can't make the suite hang
    })
);

beforeEach(() => {
  handlers = {};
  requests = [];
});

afterEach(() => jest.restoreAllMocks());

const html = (body: string, headers: Record<string, string> = {}): Handler => (_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...headers });
  res.end(body);
};

const failure = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as AiRequestError);

describe("parseJobUrl", () => {
  test.each([
    ["https://example.com/jobs/1", "https://example.com/jobs/1"],
    ["  https://example.com/jobs/1  ", "https://example.com/jobs/1"],
    ["http://example.com", "http://example.com/"],
    ["https://example.com:443/x", "https://example.com/x"],
    ["https://8.8.8.8/x", "https://8.8.8.8/x"],
  ])("accepts %s", (input, expected) => {
    expect(parseJobUrl(input, DEFAULT_GUARD).href).toBe(expected);
  });

  test.each([
    ["not a url"],
    [""],
    ["example.com/jobs"],
    ["ftp://example.com/file"],
    ["file:///etc/passwd"],
    ["javascript:alert(1)"],
    ["data:text/html,hi"],
  ])("rejects %p as not a web link", (input) => {
    const error = (() => { try { parseJobUrl(input, DEFAULT_GUARD); } catch (e) { return e as AiRequestError; } })();
    expect(error).toBeInstanceOf(AiRequestError);
    expect(error?.status).toBe(400);
  });

  test.each([
    "http://localhost/admin",
    "http://localhost:80/admin",
    "http://app.localhost/",
    "http://printer.local/",
    "http://db.internal/",
    "http://127.0.0.1/",
    "http://127.1/", // shorthand the URL parser expands to 127.0.0.1
    "http://2130706433/", // decimal form of 127.0.0.1
    "http://0x7f.0.0.1/",
    "http://0177.0.0.1/", // octal
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fe80::1]/",
    "http://[fd00::1]/",
    "https://user:pass@example.com/",
    "https://example.com:8080/",
    "https://example.com:22/",
    "http://example.com:8443/",
  ])("rejects %s as not a public web page", (input) => {
    const error = (() => { try { parseJobUrl(input, DEFAULT_GUARD); } catch (e) { return e as AiRequestError; } })();
    expect(error).toBeInstanceOf(AiRequestError);
    expect(error?.status).toBe(400);
    expect(error?.message).toMatch(/public web page/i);
  });
});

describe("fetchJobPage", () => {
  test("downloads a page, asks for an uncompressed body and sends no cookies", async () => {
    handlers["/job"] = html("<html><body>Hello job</body></html>");

    const result = await fetchJobPage(local("/job"), { guard: localGuard() });

    expect(result).toEqual({ url: local("/job"), html: "<html><body>Hello job</body></html>" });
    expect(requests).toEqual(["GET /job identity"]);
  });

  test("follows a redirect and reports the final address", async () => {
    handlers["/old"] = (_req, res) => res.writeHead(301, { Location: "/new" }).end();
    handlers["/new"] = html("moved here");

    const result = await fetchJobPage(local("/old"), { guard: localGuard() });

    expect(result).toEqual({ url: local("/new"), html: "moved here" });
  });

  test("refuses a redirect to an internal address, without connecting to it", async () => {
    handlers["/trap"] = (_req, res) => res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" }).end();

    const error = await failure(fetchJobPage(local("/trap"), { guard: localGuard() }));

    expect(error).toBeInstanceOf(AiRequestError);
    expect(error?.status).toBe(400);
    expect(error?.message).toMatch(/public web page/i);
  });

  test("refuses a redirect to another port or a non-web scheme", async () => {
    handlers["/a"] = (_req, res) => res.writeHead(302, { Location: `http://127.0.0.1:${port + 1}/` }).end();
    handlers["/b"] = (_req, res) => res.writeHead(302, { Location: "file:///etc/passwd" }).end();

    expect((await failure(fetchJobPage(local("/a"), { guard: localGuard() })))?.status).toBe(400);
    expect((await failure(fetchJobPage(local("/b"), { guard: localGuard() })))?.status).toBe(400);
  });

  test("gives up after too many redirects", async () => {
    handlers["/loop"] = (_req, res) => res.writeHead(302, { Location: "/loop" }).end();

    const error = await failure(fetchJobPage(local("/loop"), { guard: localGuard() }));

    expect(error?.status).toBe(422);
    expect(error?.message).toMatch(/redirects too many times/i);
    expect(requests).toHaveLength(4); // the first request plus 3 redirects
  });

  test.each([
    [404, /wasn't found/i],
    [410, /wasn't found/i],
    [403, /automated access/i],
    [401, /automated access/i],
    [429, /automated access/i],
    [500, /automated access/i],
  ])("answers a clear message for a %i from the site", async (status, message) => {
    handlers["/x"] = (_req, res) => res.writeHead(status).end("nope");

    const error = await failure(fetchJobPage(local("/x"), { guard: localGuard() }));

    expect(error?.status).toBe(422);
    expect(error?.message).toMatch(message);
    expect(error?.message).toMatch(/paste the job description/i);
  });

  test("refuses something that is not a web page", async () => {
    handlers["/data"] = (_req, res) => res.writeHead(200, { "Content-Type": "application/pdf" }).end("%PDF-1.7");

    const error = await failure(fetchJobPage(local("/data"), { guard: localGuard() }));

    expect(error?.status).toBe(422);
    expect(error?.message).toMatch(/isn't a web page/i);
  });

  test("refuses a compressed response it can't read", async () => {
    handlers["/gz"] = html("zzz", { "Content-Encoding": "gzip" });
    expect((await failure(fetchJobPage(local("/gz"), { guard: localGuard() })))?.status).toBe(422);
  });

  test("keeps the start of a page that is larger than the limit", async () => {
    handlers["/big"] = html("A".repeat(50_000));

    const result = await fetchJobPage(local("/big"), { guard: localGuard(), maxBytes: 10_000 });

    expect(result.html).toBe("A".repeat(10_000));
  });

  test("gives up on a server that never answers", async () => {
    handlers["/slow"] = () => undefined; // never responds

    const started = Date.now();
    const error = await failure(fetchJobPage(local("/slow"), { guard: localGuard(), timeoutMs: 300 }));

    expect(error?.status).toBe(422);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  test("gives up on a server that keeps dripping data, so it can't hold the request open", async () => {
    let timer: ReturnType<typeof setInterval> | undefined;
    handlers["/drip"] = (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      timer = setInterval(() => res.write("x"), 50); // an idle timeout would never fire
      res.on("close", () => clearInterval(timer));
    };

    const started = Date.now();
    const error = await failure(fetchJobPage(local("/drip"), { guard: localGuard(), timeoutMs: 400 }));
    clearInterval(timer);

    expect(error?.status).toBe(422);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test("decodes the page in the charset it declares", async () => {
    handlers["/latin"] = (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=iso-8859-1" });
      res.end(Buffer.from("Café manager", "latin1"));
    };
    handlers["/meta"] = (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(Buffer.concat([Buffer.from('<meta charset="windows-1252">', "latin1"), Buffer.from("Café", "latin1")]));
    };

    expect((await fetchJobPage(local("/latin"), { guard: localGuard() })).html).toBe("Café manager");
    expect((await fetchJobPage(local("/meta"), { guard: localGuard() })).html).toContain("Café");
  });

  test("falls back to UTF-8 for a charset it doesn't know", async () => {
    handlers["/odd"] = html("plain text", { "Content-Type": "text/html; charset=made-up-9000" });
    expect((await fetchJobPage(local("/odd"), { guard: localGuard() })).html).toBe("plain text");
  });

  test("reports a connection failure as a page that can't be opened", async () => {
    const error = await failure(fetchJobPage(`http://127.0.0.1:${port + 1}/`, { guard: { isAllowedAddress: () => true, allowedPorts: [port + 1] } }));
    expect(error?.status).toBe(422);
    expect(error?.message).toMatch(/couldn't open that link/i);
  });

  describe("name lookups", () => {
    const fakeLookup = (addresses: { address: string; family: number }[]) =>
      jest.spyOn(dns, "lookup").mockImplementation(((_host: string, _opts: unknown, cb: (...a: unknown[]) => void) => cb(null, addresses)) as never);

    test("refuses a hostname that resolves to a private address, and never connects", async () => {
      fakeLookup([{ address: "10.0.0.5", family: 4 }]);

      const error = await failure(fetchJobPage("http://jobs.example.com/", { guard: DEFAULT_GUARD }));

      expect(error?.status).toBe(400);
      expect(error?.message).toMatch(/public web page/i);
      expect(requests).toEqual([]);
    });

    test("refuses a hostname if any one of its addresses is private", async () => {
      fakeLookup([
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]);

      const error = await failure(fetchJobPage("http://jobs.example.com/", { guard: DEFAULT_GUARD }));

      expect(error?.status).toBe(400);
    });

    test("refuses a hostname that resolves to the metadata service, even written as an IPv4-mapped IPv6 address", async () => {
      fakeLookup([{ address: "::ffff:169.254.169.254", family: 6 }]);
      expect((await failure(fetchJobPage("http://jobs.example.com/", { guard: DEFAULT_GUARD })))?.status).toBe(400);
    });

    test("connects to the very address the lookup returned", async () => {
      handlers["/job"] = html("via lookup");
      const lookup = fakeLookup([{ address: "127.0.0.1", family: 4 }]);

      const result = await fetchJobPage(`http://jobs.example.com:${port}/job`, { guard: localGuard() });

      expect(result.html).toBe("via lookup");
      expect(lookup).toHaveBeenCalledWith("jobs.example.com", expect.objectContaining({ all: true }), expect.any(Function));
    });

    test("treats a failed lookup as a page that can't be opened", async () => {
      jest.spyOn(dns, "lookup").mockImplementation(((_h: string, _o: unknown, cb: (...a: unknown[]) => void) => cb(new Error("ENOTFOUND"))) as never);
      const error = await failure(fetchJobPage("http://no-such-host.example/", { guard: DEFAULT_GUARD }));
      expect(error?.status).toBe(422);
    });
  });
});
