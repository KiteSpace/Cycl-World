import JSZip from "jszip";

export async function downloadZip(
  zipName: string,
  files: { name: string; content: string }[],
) {
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.name, f.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName.endsWith(".zip") ? zipName : `${zipName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
