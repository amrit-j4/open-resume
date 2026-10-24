/**
 * @jest-environment node
 */
import { isAuthorized } from "lib/resume-import/authorize";

const fetchMock = jest.fn();
const originalEnv = process.env;

const request = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/resume-import", { method: "POST", headers });

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  process.env = { ...originalEnv, RESUME_IMPORT_API_KEY: "s3cret" };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("isAuthorized", () => {
  test("allows the shared secret", async () => {
    expect(await isAuthorized(request({ "x-api-key": "s3cret" }))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects a wrong or different-length secret", async () => {
    expect(await isAuthorized(request({ "x-api-key": "wrong!" }))).toBe(false);
    expect(await isAuthorized(request({ "x-api-key": "s3cret-and-more" }))).toBe(false);
    expect(await isAuthorized(request({ "x-api-key": "" }))).toBe(false);
  });

  test("never accepts a secret when none is configured", async () => {
    delete process.env.RESUME_IMPORT_API_KEY;
    expect(await isAuthorized(request({ "x-api-key": "" }))).toBe(false);
    expect(await isAuthorized(request({ "x-api-key": "undefined" }))).toBe(false);
  });

  test("rejects a request with no credentials", async () => {
    expect(await isAuthorized(request())).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("allows a bearer token the API accepts, and forwards it", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    expect(await isAuthorized(request({ authorization: "Bearer good-token" }))).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/me$/);
    expect(init.headers).toEqual({ Authorization: "Bearer good-token" });
  });

  test("rejects a bearer token the API refuses", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    expect(await isAuthorized(request({ authorization: "Bearer bad-token" }))).toBe(false);
  });

  test("rejects when the API cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("network down"));
    expect(await isAuthorized(request({ authorization: "Bearer any" }))).toBe(false);
  });

  test("ignores an authorization header that is not a bearer token", async () => {
    expect(await isAuthorized(request({ authorization: "Basic abc" }))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
