/**
 * Decides whether an IP address is a public internet address. The job link feature makes our server fetch a URL a visitor typed, so it must
 * never be steered to the server's own machine, the local network or a cloud metadata service (169.254.169.254). Everything that isn't
 * clearly public is refused. Pure string and number work, so it has no imports and is easy to test.
 */

const parseIpv4 = (value: string): number[] | null => {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  return bytes.every((b) => b >= 0 && b <= 255) ? bytes : null;
};

const isPublicIpv4 = ([a, b, c]: number[]): boolean => {
  if (a === 0 || a === 10 || a === 127) return false; // this network, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, including the metadata service
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // protocol assignments, documentation
  if (a === 192 && b === 168) return false; // private
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // documentation
  if (a === 203 && b === 0 && c === 113) return false; // documentation
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
};

/** Parses an IPv6 address into 16 bytes, or null when it isn't valid. Handles "::" and a trailing IPv4 part. */
const parseIpv6 = (input: string): number[] | null => {
  const value = input.split("%")[0]; // drop a zone id such as "fe80::1%eth0"
  if (!value.includes(":")) return null;

  let tail: number[] = [];
  let text = value;
  const lastColon = text.lastIndexOf(":");
  if (text.slice(lastColon + 1).includes(".")) {
    const v4 = parseIpv4(text.slice(lastColon + 1));
    if (!v4) return null;
    tail = v4;
    text = `${text.slice(0, lastColon + 1)}0:0`; // two groups stand in for the IPv4 bytes
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const toGroups = (half: string) => (half === "" ? [] : half.split(":"));
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;

  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g))) return null;

  const bytes = groups.flatMap((g) => {
    const n = parseInt(g, 16);
    return [n >> 8, n & 0xff];
  });
  if (tail.length === 4) bytes.splice(12, 4, ...tail);
  return bytes;
};

const isPublicIpv6 = (bytes: number[]): boolean => {
  const allZero = (from: number, to: number) => bytes.slice(from, to).every((b) => b === 0);

  if (allZero(0, 15) && (bytes[15] === 0 || bytes[15] === 1)) return false; // :: and ::1
  // ::ffff:a.b.c.d (IPv4-mapped), ::a.b.c.d (deprecated IPv4-compatible) and 64:ff9b::a.b.c.d (NAT64) carry an IPv4 address.
  if (allZero(0, 10) && bytes[10] === 0xff && bytes[11] === 0xff) return isPublicIpv4(bytes.slice(12));
  if (allZero(0, 12)) return isPublicIpv4(bytes.slice(12));
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && allZero(4, 12)) return isPublicIpv4(bytes.slice(12));

  if ((bytes[0] & 0xfe) === 0xfc) return false; // fc00::/7 unique local
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return false; // fe80::/10 link-local
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return false; // fec0::/10 site-local (deprecated)
  if (bytes[0] === 0xff) return false; // multicast
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return false; // documentation
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) return false; // Teredo
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return isPublicIpv4(bytes.slice(2, 6)); // 6to4 embeds an IPv4 address
  if (bytes[0] === 0x01 && bytes[1] === 0x00 && allZero(2, 8)) return false; // 100::/64 discard-only

  return (bytes[0] & 0xe0) === 0x20; // only global unicast 2000::/3 is considered public
};

/** True only for a well-formed public IPv4 or IPv6 address. Anything malformed or not clearly public is false. */
export const isPublicAddress = (address: string): boolean => {
  const v4 = parseIpv4(address);
  if (v4) return isPublicIpv4(v4);
  const v6 = parseIpv6(address);
  return v6 ? isPublicIpv6(v6) : false;
};

/** True when the text is an IP address literal (so a hostname lookup isn't needed, and the address itself must be checked). */
export const isIpLiteral = (value: string): boolean => parseIpv4(value) !== null || parseIpv6(value.replace(/^\[|\]$/g, "")) !== null;
