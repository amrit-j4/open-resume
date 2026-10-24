import { isIpLiteral, isPublicAddress } from "lib/resume-analysis/job-page/ip-guard";

describe("isPublicAddress", () => {
  test.each([
    "8.8.8.8",
    "1.1.1.1",
    "93.184.216.34",
    "172.15.0.1", // just below 172.16/12
    "172.32.0.1", // just above it
    "100.63.255.255", // just below carrier-grade NAT
    "100.128.0.1", // just above it
    "169.253.1.1",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
  ])("allows public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  test.each([
    ["this network", "0.0.0.0"],
    ["this network", "0.1.2.3"],
    ["private 10/8", "10.0.0.1"],
    ["private 10/8", "10.255.255.255"],
    ["loopback", "127.0.0.1"],
    ["loopback", "127.255.0.9"],
    ["carrier-grade NAT", "100.64.0.1"],
    ["carrier-grade NAT", "100.127.255.255"],
    ["metadata service", "169.254.169.254"],
    ["link-local", "169.254.0.1"],
    ["private 172.16/12", "172.16.0.1"],
    ["private 172.16/12", "172.31.255.255"],
    ["private 192.168/16", "192.168.1.1"],
    ["documentation", "192.0.2.5"],
    ["documentation", "198.51.100.7"],
    ["documentation", "203.0.113.9"],
    ["benchmarking", "198.18.0.1"],
    ["multicast", "224.0.0.1"],
    ["reserved", "240.0.0.1"],
    ["broadcast", "255.255.255.255"],
    ["IPv6 unspecified", "::"],
    ["IPv6 loopback", "::1"],
    ["IPv6 unique local", "fc00::1"],
    ["IPv6 unique local", "fd12:3456:789a::1"],
    ["IPv6 link-local", "fe80::1"],
    ["IPv6 link-local with zone", "fe80::1%eth0"],
    ["IPv6 multicast", "ff02::1"],
    ["IPv6 documentation", "2001:db8::1"],
    ["IPv6 Teredo", "2001:0:4136:e378:8000:63bf:3fff:fdd2"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped loopback (hex)", "::ffff:7f00:1"],
    ["IPv4-mapped metadata service", "::ffff:169.254.169.254"],
    ["IPv4-mapped private", "::ffff:10.1.2.3"],
    ["NAT64 loopback", "64:ff9b::7f00:1"],
    ["6to4 of a private address", "2002:c0a8:0101::1"],
    ["IPv4-compatible loopback", "::127.0.0.1"],
  ])("blocks %s (%s)", (_name, address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  test("allows an IPv4-mapped public address", () => {
    expect(isPublicAddress("::ffff:8.8.8.8")).toBe(true);
  });

  test.each(["", "not-an-ip", "256.1.1.1", "1.2.3", "1.2.3.4.5", "01.2.3.4x", "1.2.3.-4", "::1::2", "12345::1", "gggg::1", "1:2:3:4:5:6:7", "localhost"])(
    "treats malformed input %p as not public",
    (address) => {
      expect(isPublicAddress(address)).toBe(false);
    }
  );
});

describe("isIpLiteral", () => {
  test.each(["8.8.8.8", "127.0.0.1", "::1", "[::1]", "2606:4700::1111", "::ffff:1.2.3.4"])("%s is an address", (value) => {
    expect(isIpLiteral(value)).toBe(true);
  });

  test.each(["example.com", "localhost", "1.2.3", "a.b.c.d", ""])("%s is not an address", (value) => {
    expect(isIpLiteral(value)).toBe(false);
  });
});
