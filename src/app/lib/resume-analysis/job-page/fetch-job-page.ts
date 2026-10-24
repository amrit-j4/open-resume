import dns from "dns";
import http from "http";
import https from "https";
import { AiRequestError } from "lib/ai/gemini";
import { isIpLiteral, isPublicAddress } from "lib/resume-analysis/job-page/ip-guard";

const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 3 * 1024 * 1024;

export interface FetchGuard {
  /** Whether the server may connect to this IP address. */
  isAllowedAddress: (address: string) => boolean;
  /** Ports a link may use; a link without a port uses the scheme's default (80 or 443). */
  allowedPorts: number[];
}

/** Public internet addresses on the web's standard ports only. Tests replace this to reach a local server. */
export const DEFAULT_GUARD: FetchGuard = { isAllowedAddress: isPublicAddress, allowedPorts: [80, 443] };

export interface FetchJobPageOptions {
  guard?: FetchGuard;
  timeoutMs?: number;
  maxBytes?: number;
}

const BLOCKED_BY_SITE = "We couldn't open that link. The site may not allow automated access. Paste the job description instead.";

const badLink = (message: string) => new AiRequestError(message, 400);
const cantRead = (message: string) => new AiRequestError(message, 422);

const NOT_PUBLIC = "That link isn't a public web page. Paste the job description instead.";

/** Checks a link before any connection is made. Throws a user-facing `AiRequestError` for anything that isn't an ordinary public web page. */
export const parseJobUrl = (raw: string, guard: FetchGuard): URL => {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw badLink("Enter a full link that starts with http:// or https://.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw badLink("Enter a full link that starts with http:// or https://.");
  }
  if (url.username || url.password) {
    throw badLink(NOT_PUBLIC);
  }
  const defaultPort = url.protocol === "https:" ? 443 : 80;
  const port = url.port ? Number(url.port) : defaultPort;
  if (!guard.allowedPorts.includes(port)) {
    throw badLink(NOT_PUBLIC);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw badLink(NOT_PUBLIC);
  }
  if (isIpLiteral(host) && !guard.isAllowedAddress(host)) {
    throw badLink(NOT_PUBLIC);
  }
  return url;
};

/**
 * A `lookup` for the connection that refuses to connect to anything the guard rejects. Because the check happens on the very address the
 * socket will use, a hostname can't pass a check and then resolve somewhere else when the connection is made (DNS rebinding).
 */
const guardedLookup =
  (guard: FetchGuard) =>
  (hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
    dns.lookup(hostname, { ...options, all: true, verbatim: true }, (error, addresses) => {
      if (error) return callback(error);
      const list = addresses as dns.LookupAddress[];
      if (list.length === 0 || !list.every((entry) => guard.isAllowedAddress(entry.address))) {
        return callback(Object.assign(new Error("Blocked address"), { code: "EBLOCKED" }));
      }
      return options.all ? callback(null, list) : callback(null, list[0].address, list[0].family);
    });
  };

const charsetOf = (contentType: string, head: string): string => {
  const fromHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1];
  const fromMeta = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1];
  return (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
};

const decodeBody = (body: Buffer, contentType: string): string => {
  const charset = charsetOf(contentType, body.subarray(0, 2048).toString("latin1"));
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
};

interface Fetched {
  status: number;
  location?: string;
  contentType: string;
  contentEncoding: string;
  body: Buffer;
}

const requestOnce = (url: URL, guard: FetchGuard, deadline: number, maxBytes: number): Promise<Fetched> =>
  new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new Error("timeout"));

    const transport = url.protocol === "https:" ? https : http;
    // A hard deadline for the whole download, so a server that drips one byte at a time can't hold the request open.
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const done = <T,>(settle: (value: T) => void) => (value: T) => {
      clearTimeout(deadlineTimer);
      settle(value);
    };
    const finishWith = done(resolve);
    const failWith = done(reject);

    const request = transport.request(
      url,
      {
        method: "GET",
        agent: false,
        lookup: guardedLookup(guard) as never,
        headers: {
          "User-Agent": "Job4OnlineBot/1.0 (+https://job4online.com.au)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Encoding": "identity",
          "Accept-Language": "en-AU,en;q=0.8",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        const finish = () =>
          finishWith({
            status: response.statusCode ?? 0,
            location: response.headers.location,
            contentType: String(response.headers["content-type"] ?? ""),
            contentEncoding: String(response.headers["content-encoding"] ?? "identity").toLowerCase(),
            body: Buffer.concat(chunks),
          });

        // A redirect's body is never needed, and an error page's isn't either, so don't download it.
        const status = response.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          response.destroy();
          return finish();
        }

        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          chunks.push(size > maxBytes ? chunk.subarray(0, chunk.length - (size - maxBytes)) : chunk);
          if (size >= maxBytes) {
            response.destroy(); // keep what we have: a page that long still has its job text near the top
            finish();
          }
        });
        response.on("end", finish);
        response.on("error", (error) => (size >= maxBytes ? undefined : failWith(error)));
      }
    );

    deadlineTimer = setTimeout(() => request.destroy(new Error("timeout")), remaining);
    request.on("error", failWith);
    request.end();
  });

/**
 * Downloads a job page for a link a visitor typed. The server only ever talks to public web servers on standard ports: the link is checked up
 * front, every connection is checked at connect time, each redirect is checked again, and the whole thing is time and size limited.
 * Throws `AiRequestError` with a message to show the visitor (400 for a bad link, 422 when the page can't be used).
 */
export const fetchJobPage = async (rawUrl: string, options: FetchJobPageOptions = {}): Promise<{ url: string; html: string }> => {
  const guard = options.guard ?? DEFAULT_GUARD;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let url = parseJobUrl(rawUrl, guard);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let result: Fetched;
    try {
      result = await requestOnce(url, guard, deadline, maxBytes);
    } catch (error) {
      if ((error as { code?: string }).code === "EBLOCKED") throw badLink(NOT_PUBLIC);
      throw cantRead(BLOCKED_BY_SITE);
    }

    if (result.status >= 300 && result.status < 400 && result.location) {
      try {
        url = parseJobUrl(new URL(result.location, url).href, guard);
      } catch (error) {
        throw error instanceof AiRequestError ? error : cantRead(BLOCKED_BY_SITE);
      }
      continue;
    }

    if (result.status === 404 || result.status === 410) {
      throw cantRead("That page wasn't found. Check the link, or paste the job description instead.");
    }
    if (result.status < 200 || result.status >= 300) {
      throw cantRead(BLOCKED_BY_SITE);
    }
    if (!/html|xml|text\/plain/i.test(result.contentType)) {
      throw cantRead("That link isn't a web page. Paste the job description instead.");
    }
    if (result.contentEncoding !== "identity" && result.contentEncoding !== "") {
      throw cantRead(BLOCKED_BY_SITE);
    }
    return { url: url.href, html: decodeBody(result.body, result.contentType) };
  }

  throw cantRead("That link redirects too many times. Paste the job description instead.");
};
