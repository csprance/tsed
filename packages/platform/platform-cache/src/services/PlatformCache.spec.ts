import {PlatformTest} from "@tsed/common";
import {caching as cacheManager, multiCaching} from "cache-manager";
import {PlatformCache} from "./PlatformCache";

function createCacheFixture() {
  const map = new Map();
  return {
    get: jest.fn().mockImplementation((key) => {
      return Promise.resolve(map.get(key));
    }),
    set: jest.fn().mockImplementation((key, value) => {
      return Promise.resolve(map.set(key, value));
    }),
    wrap: jest.fn().mockImplementation((key, fn) => {
      return fn();
    }),
    reset: jest.fn().mockImplementation(() => {
      map.clear();
    }),
    del: jest.fn().mockImplementation((key) => {
      map.delete(key);
    }),

    store: {
      keys: jest.fn().mockImplementation(() => {
        return [...map.keys()];
      }),
      ttl: jest.fn()
    }
  };
}

jest.mock("cache-manager");

describe("PlatformCache", () => {
  describe("with legacy single cache", () => {
    let caching: ReturnType<typeof createCacheFixture>;

    beforeEach(async () => {
      caching = createCacheFixture();

      (cacheManager as jest.Mock).mockReturnValue(caching as any);

      await PlatformTest.create({
        cache: {
          store: {create: () => caching},
          ttl: 300
        }
      });
    });

    afterEach(() => {
      return PlatformTest.reset();
    });

    it("should create single cache", async () => {
      const cacheManager = PlatformTest.get<PlatformCache>(PlatformCache);

      expect(cacheManager.disabled()).toEqual(false);

      await cacheManager.set("key", "value");
      await cacheManager.set("key2", "value2");
      expect(await cacheManager.get("key")).toBe("value");
      expect(await cacheManager.get("key2")).toBe("value2");

      await cacheManager.del("key2");

      expect(await cacheManager.get("key2")).toBeUndefined();

      await cacheManager.reset();

      expect(await cacheManager.get("key")).toBeUndefined();

      const result = await cacheManager.wrap("key", () => {
        return Promise.resolve("valuePromised");
      });

      expect(result).toBe("valuePromised");
    });
  });
  describe("with single cache", () => {
    let caching: ReturnType<typeof createCacheFixture>;

    beforeEach(async () => {
      caching = createCacheFixture();

      (cacheManager as jest.Mock).mockReturnValue(caching as any);

      await PlatformTest.create({
        cache: {
          store: "memory",
          ttl: 300
        }
      });
    });

    afterEach(() => {
      return PlatformTest.reset();
    });

    it("should create single cache", async () => {
      const cacheManager = PlatformTest.get<PlatformCache>(PlatformCache);

      expect(cacheManager.disabled()).toEqual(false);

      await cacheManager.set("key", "value");
      await cacheManager.set("key2", "value2");
      expect(await cacheManager.get("key")).toBe("value");
      expect(await cacheManager.get("key2")).toBe("value2");

      await cacheManager.del("key2");

      expect(await cacheManager.get("key2")).toBeUndefined();

      await cacheManager.reset();

      expect(await cacheManager.get("key")).toBeUndefined();

      const result = await cacheManager.wrap("key", () => {
        return Promise.resolve("valuePromised");
      });

      expect(result).toBe("valuePromised");
    });

    it("should return the calculated calculateTTL", () => {
      const cacheManager = PlatformTest.get<PlatformCache>(PlatformCache);

      expect(cacheManager.calculateTTL({}, 400)).toBe(400);
      expect(cacheManager.calculateTTL({}, () => 200)).toBe(200);
      expect(cacheManager.calculateTTL({})).toBe(300);
      expect(cacheManager.calculateTTL()).toBe(300);
    });

    it("should get matching keys", async () => {
      const cacheManager = PlatformTest.get<PlatformCache>(PlatformCache);

      await cacheManager.set("key", "value");
      await cacheManager.set("key2", "value2");

      const keys1 = await cacheManager.getMatchingKeys("key*");
      const keys2 = await cacheManager.getMatchingKeys("key2");

      expect(keys1).toEqual(["key", "key2"]);
      expect(keys2).toEqual(["key2"]);
    });

    it("should delete matching keys", async () => {
      const cacheManager = PlatformTest.get<PlatformCache>(PlatformCache);

      await cacheManager.set("key", "value");
      await cacheManager.set("key2", "value2");

      const keys1 = await cacheManager.getMatchingKeys("key*");
      const keys2 = await cacheManager.deleteMatchingKeys("key*");

      expect(keys1).toEqual(["key", "key2"]);
      expect(keys2).toEqual(["key", "key2"]);
    });

    describe("defaultKeyResolver()", () => {
      it("return the default key resolver from settings", () => {
        const cacheManager = PlatformTest.get<PlatformCache>(PlatformCache);
        const keyResolver = cacheManager.defaultKeyResolver();

        const value = keyResolver(["test"], {});
        expect(value).toEqual("test");

        const value2 = keyResolver([{test: "test"}], {});
        expect(value2).toEqual('{"test":"test"}');
      });
    });

    describe("ttl()", () => {
      it("return calculateTTL of the given key", async () => {
        const cacheManager: any = PlatformTest.get<PlatformCache>(PlatformCache);

        cacheManager.cache.store.ttl.mockReturnValue(10);

        const result = await cacheManager.ttl("test");
        expect(result).toEqual(10);
      });

      it("return undefined when store isn't defined", async () => {
        const cacheManager: any = PlatformTest.get<PlatformCache>(PlatformCache);

        delete cacheManager.cache.store.ttl;

        const result = await cacheManager.ttl("test");
        expect(result).toEqual(undefined);
      });
    });
    describe("getCachedObject()", () => {
      it("should get key from cache", async () => {
        const cacheManager = PlatformTest.get<PlatformCache>(PlatformCache);

        await cacheManager.setCachedObject("key", {data: "data"}, {ttl: 10});
        const result = await cacheManager.getCachedObject("key");

        expect(result).toEqual({
          data: '{"data":"data"}',
          ttl: 10
        });
      });
      it("should catch and log error", async () => {
        const cacheManager: any = PlatformTest.get<PlatformCache>(PlatformCache);

        jest.spyOn(cacheManager, "get").mockRejectedValue(new Error("message"));
        jest.spyOn(cacheManager.logger, "error");

        await cacheManager.getCachedObject("key");

        expect(cacheManager.get).toHaveBeenCalledWith("key");
        expect(cacheManager.logger.error).toHaveBeenCalledWith({
          error: new Error("message"),
          event: "CACHE_ERROR",
          method: "getCachedObject"
        });
      });
    });
    describe("setCachedObject()", () => {
      it("should catch and log error", async () => {
        const cacheManager: any = PlatformTest.get<PlatformCache>(PlatformCache);

        jest.spyOn(cacheManager, "set").mockRejectedValue(new Error("message"));
        jest.spyOn(cacheManager.logger, "error");

        await cacheManager.setCachedObject("key", {data: "data"}, {ttl: 10});

        expect(cacheManager.set).toHaveBeenCalledWith("key", {data: '{"data":"data"}', ttl: 10}, {ttl: 10});
        expect(cacheManager.logger.error).toHaveBeenCalledWith({
          error: new Error("message"),
          event: "CACHE_ERROR",
          method: "setCachedObject"
        });
      });
    });
    describe("refresh()", () => {
      it("should set the call context with forceRefresh to true", async () => {
        const cacheManager = PlatformTest.get<PlatformCache>(PlatformCache);

        expect(cacheManager.isForceRefresh()).toEqual(false);

        await cacheManager.refresh(() => {
          expect(cacheManager.isForceRefresh()).toEqual(true);
        });

        expect(cacheManager.isForceRefresh()).toEqual(false);
      });
    });
  });
  describe("with multiple cache", () => {
    let caching: ReturnType<typeof createCacheFixture>;
    beforeEach(() => {
      caching = createCacheFixture();

      (multiCaching as jest.Mock).mockReturnValue(caching as any);

      return PlatformTest.create({
        cache: {
          caches: [{}, {}] as any[],
          ttl: 300
        }
      });
    });
    afterEach(() => {
      return PlatformTest.reset();
    });

    it("should create multiple cache", async () => {
      const cacheManager = PlatformTest.get<PlatformCache>(PlatformCache);

      await cacheManager.set("key", "value");
      await cacheManager.set("key2", "value2");
      expect(await cacheManager.get("key")).toBe("value");
      expect(await cacheManager.get("key2")).toBe("value2");
      expect(await cacheManager.keys()).toEqual(["key", "key2"]);

      await cacheManager.del("key2");

      expect(await cacheManager.get("key2")).toBeUndefined();

      await cacheManager.reset();

      expect(await cacheManager.get("key")).toBeUndefined();

      const result = await cacheManager.wrap("key", () => {
        return Promise.resolve("valuePromised");
      });

      expect(result).toBe("valuePromised");
    });
  });
  describe("with disabled cache", () => {
    beforeEach(() =>
      PlatformTest.create({
        cache: false
      })
    );
    afterEach(() => PlatformTest.reset());

    it("should mock methods", async () => {
      const cacheManager = PlatformTest.get<PlatformCache>(PlatformCache);

      expect(cacheManager.disabled()).toEqual(true);

      await cacheManager.set("key", "value");
      await cacheManager.set("key2", "value2");
      expect(await cacheManager.get("key")).toBeUndefined();
      expect(await cacheManager.get("key2")).toBeUndefined();

      await cacheManager.del("key2");

      expect(await cacheManager.get("key2")).toBeUndefined();

      await cacheManager.reset();

      expect(await cacheManager.get("key")).toBeUndefined();
      expect(await cacheManager.keys()).toEqual([]);

      const result = await cacheManager.wrap("key", () => {
        return Promise.resolve("valuePromised");
      });

      expect(result).toBe("valuePromised");
    });
  });
});
