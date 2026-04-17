import { handleTriage } from "./triage.js";
import { generate } from "./generator.js";

export default {
  async fetch(req) {
    if (req.method === "POST" && req.url.endsWith("/analyze")) {
      const formData = await req.formData();
      const file = formData.get("file");

      const triage = await handleTriage(file);
      const result = await generate(file, triage.route);

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("OK");
  }
};

