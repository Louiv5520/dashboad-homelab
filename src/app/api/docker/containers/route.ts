import { isAuthenticated } from "@/lib/auth";
import { createDockerContainer } from "@/lib/docker-client";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(2),
  image: z.string().min(2),
  ports: z.string().optional(),
  env: z.string().optional(),
  cmd: z.string().optional(),
  restartAlways: z.boolean().optional(),
  startAfterCreate: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  try {
    const input = createSchema.parse(await request.json());
    const result = await createDockerContainer(input);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { error: `Kunne ikke oprette Docker-container: ${(error as Error).message}` },
      { status: 400 }
    );
  }
}
