import type { MagickFormat } from "@imagemagick/magick-wasm";

interface Options {
  extension: keyof typeof MagickFormat;
}

export async function convertImage(file: File, options: Options): Promise<Blob> {
  const [
    { initializeImageMagick, ImageMagick, MagickFormat },
    magickWasmModule,
    { dump, insert, ImageIFD },
  ] = await Promise.all([
    import("@imagemagick/magick-wasm"),
    import("@imagemagick/magick-wasm/magick.wasm?binary"),
    import("piexifjs"),
  ]);
  const magickWasm = magickWasmModule.default;

  await initializeImageMagick(magickWasm);

  const format = MagickFormat[options.extension];
  const byteArray = new Uint8Array(await file.arrayBuffer());

  return new Promise((resolve) => {
    ImageMagick.read(byteArray, (img) => {
      img.format = format;

      const comment = img.comment;

      img.write((output) => {
        if (comment == null) {
          resolve(new Blob([output as Uint8Array<ArrayBuffer>]));
          return;
        }

        // ImageMagick では EXIF の ImageDescription フィールドに保存されているデータが
        // 非標準の Comment フィールドに移されてしまうため
        // piexifjs を使って ImageDescription フィールドに書き込む
        const binary = Array.from(output as Uint8Array<ArrayBuffer>)
          .map((b) => String.fromCharCode(b))
          .join("");
        const descriptionBinary = Array.from(new TextEncoder().encode(comment))
          .map((b) => String.fromCharCode(b))
          .join("");
        const exifStr = dump({ "0th": { [ImageIFD.ImageDescription]: descriptionBinary } });
        const outputWithExif = insert(exifStr, binary);
        const bytes = Uint8Array.from(outputWithExif.split("").map((c) => c.charCodeAt(0)));
        resolve(new Blob([bytes]));
      });
    });
  });
}
