// src/utils/redis.js
const { createClient } = require('redis');

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Handle Redis connection events
redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis ready');
});

redisClient.on('end', () => {
  console.log('❌ Redis connection ended');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redisClient.quit();
  process.exit(0);
});

// Cache helper functions
const cache = {
  async get(key) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Redis GET error:', err);
      return null;
    }
  },

  async set(key, value, ttl = null) {
    try {
      const data = JSON.stringify(value);
      if (ttl) {
        await redisClient.setEx(key, ttl, data);
      } else {
        await redisClient.set(key, data);
      }
      return true;
    } catch (err) {
      console.error('Redis SET error:', err);
      return false;
    }
  },

  async del(key) {
    try {
      await redisClient.del(key);
      return true;
    } catch (err) {
      console.error('Redis DEL error:', err);
      return false;
    }
  },

  async delPattern(pattern) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return keys.length;
    } catch (err) {
      console.error('Redis DEL pattern error:', err);
      return 0;
    }
  },

  async exists(key) {
    try {
      return await redisClient.exists(key);
    } catch (err) {
      console.error('Redis EXISTS error:', err);
      return false;
    }
  },

  /**
   * Delete Redis keys dynamically based on multiple match arrays
   * @param {string[][]} patternsList - Array of pattern arrays
   * Example:
   *   [
   *     ["feed"],
   *     ["feed", "123"],
   *     ["feed", "services", "123"],
   *     ["people", "123"]
   *   ]
   */
  
  async deleteKeys(patternsList) {
  if (!Array.isArray(patternsList) || patternsList.length === 0) {
    throw new Error("deleteKeys requires a non-empty array of arrays");
  }

  let totalDeleted = 0;

  for (const parts of patternsList) {
    if (!Array.isArray(parts) || parts.length === 0) continue;

    // Build flexible pattern: feed*jobs*userId
    const pattern = parts.join("*");

    let cursor = "0";
    let deleted = 0;

    do {
      const res = await redisClient.scan(cursor, {
        MATCH: `${pattern}*`, // ensure trailing *
        COUNT: 100
      });

      cursor = res.cursor;
      const keys = res.keys;

      if (keys.length > 0) {
        await redisClient.del(keys);
        deleted += keys.length;
        console.log(`Deleted keys:`, keys);
      }
    } while (cursor !== "0"); // restart scan each time for this pattern

    totalDeleted += deleted;
    console.log(`✅ Deleted ${deleted} keys for pattern: ${pattern}*`);
  }

  console.log(`🔥 Total deleted across all patterns: ${totalDeleted}`);
  return totalDeleted;
}




};


module.exports = { redisClient, cache };