import { describe, expect, it } from "vitest";
import http from "node:http";
import request from "supertest";

import { GET as triggerTestGet } from "@/app/api/trigger-test/route";

describe("API integration (Supertest): /api/trigger-test", () => {
  it("responds with JSON payload on GET", async () => {
    const server = http.createServer(async (req, res) => {
      if (req.method === "GET" && req.url === "/api/trigger-test") {
        const nextRes = await triggerTestGet();
        res.statusCode = nextRes.status;
        nextRes.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await nextRes.text());
        return;
      }
      res.statusCode = 404;
      res.end("not found");
    });

    await request(server)
      .get("/api/trigger-test")
      .expect(200)
      .expect("content-type", /application\/json/);

    server.close();
  });
});

