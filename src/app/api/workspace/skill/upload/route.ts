import { withAuth } from "@/lib/server/http";
import { saveUploadedMarkdown, saveUploadedZip } from "@/lib/server/workspace";

export async function POST(request: Request) {
  return withAuth(request, async () => {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "缺少上传文件" }, { status: 400 });
    }

    if (file.name.endsWith(".zip")) {
      return Response.json(await saveUploadedZip(file));
    }
    if (file.name.endsWith(".md") || file.name === "SKILL.md") {
      return Response.json(await saveUploadedMarkdown(file));
    }
    return Response.json({ error: "仅支持 .md 或 .zip" }, { status: 400 });
  });
}
