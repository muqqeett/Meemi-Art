/**
 * Admin product upload harness — product photos and digital files.
 *
 * Proves the rules the direct-upload pipeline rests on: admin-only steps,
 * declared type and size checks, signatures that cover exactly the fields sent
 * and never carry the secret, folder-pinned storage ids, verification of what
 * storage actually holds (format, delivery type, size, and the real content of
 * a digital file), persistence of the `DigitalAsset` row the download route
 * reads, replacement and cleanup, failure handling at storage and database,
 * filename safety, and that download authorization is unchanged.
 *
 * LOCAL DATABASE ONLY, NO NETWORK.
 *
 *   - Prisma is pointed at `LOCAL_DATABASE_URL` before anything imports it; the
 *     script refuses to start unless that is a localhost database, and checks
 *     from inside the connection that the server is local.
 *   - Cloudinary, Upstash and Gemini credentials are removed before any module
 *     reads them, and every outbound HTTP(S) request and `fetch` is replaced by
 *     a tripwire that counts and refuses. The harness fails unless the count is
 *     zero. Cloudinary is exercised through an in-memory stand-in; signatures
 *     are checked with the Cloudinary SDK's own signing function, which is pure.
 *   - Fixtures are namespaced `zz-upload-test-<run>` and removed in `finally`,
 *     with the cleanup verified.
 *
 * Run: npm run test:uploads
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const localUrl = process.env.LOCAL_DATABASE_URL;
if (!localUrl) {
  console.error("Refusing to run: LOCAL_DATABASE_URL is not set.");
  process.exit(1);
}
if (!LOCAL_HOSTS.has(new URL(localUrl).hostname)) {
  console.error("Refusing to run: LOCAL_DATABASE_URL is not a local database.");
  process.exit(1);
}
// Must happen before `src/lib/prisma` is imported — it reads DATABASE_URL once.
process.env.DATABASE_URL = localUrl;

const REMOVED_CREDENTIALS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "GEMINI_API_KEY",
];
for (const name of REMOVED_CREDENTIALS) delete process.env[name];

let outbound = 0;
const refuse = (): never => {
  outbound++;
  throw new Error("Outbound network request blocked by the upload harness.");
};
globalThis.fetch = (async () => refuse()) as typeof fetch;
https.request = refuse as unknown as typeof https.request;
https.get = refuse as unknown as typeof https.get;
http.request = refuse as unknown as typeof http.request;
http.get = refuse as unknown as typeof http.get;

const RUN = `zz-upload-test-${randomUUID().slice(0, 8)}`;

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new Uint8Array(Buffer.from(value, "latin1"));

/** A small, structurally valid PDF with `pages` pages. */
function makePdf(pages: number): Uint8Array {
  const objects: string[] = [];
  const kids = Array.from({ length: pages }, (_, i) => `${3 + i} 0 R`).join(" ");
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`);
  for (let i = 0; i < pages; i++) objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>");
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return text(out);
}

const CONFIG = {
  cloudName: "demo-cloud",
  apiKey: "123456789012345",
  apiSecret: "HARNESS-SECRET-must-never-leave-the-server",
  imageFolder: "meemiart/products",
  digitalFolder: "meemiart/digital-files",
};

async function main() {
  const { v2: cloudinary } = await import("cloudinary");
  const { prisma } = await import("../src/lib/prisma");
  const types = await import("../src/lib/storage/types");
  const uploadsStorage = await import("../src/lib/storage/admin-uploads");
  const { createAdminUploadStorage, PRODUCT_IMAGE_TRANSFORMATION } = uploadsStorage;
  const uploads = await import("../src/lib/admin/product-uploads");
  const { findDownloadableAsset } = await import("../src/lib/queries/download-access");
  const digitalRoute = await import("../src/app/api/admin/digital-upload/route");
  type AdminUploadClient = import("../src/lib/storage/admin-uploads").AdminUploadClient;
  type ProductUploadDeps = import("../src/lib/admin/product-uploads").ProductUploadDeps;

  const createdUsers: string[] = [];
  const createdCategories: string[] = [];

  /** An in-memory Cloudinary: objects by resource type, delivery type and id. */
  function fakeCloud() {
    const objects = new Map<string, { resource: Record<string, unknown>; head: Uint8Array }>();
    const destroyed: string[] = [];
    let resourceCalls = 0;
    let failLookups: number | null = null;
    let failHead = false;
    const id = (resourceType: string, type: string, publicId: string) => `${resourceType}/${type}/${publicId}`;

    const client: AdminUploadClient = {
      async resource(publicId, options) {
        resourceCalls++;
        if (failLookups) throw { error: { http_code: failLookups } };
        const found = objects.get(id(options.resource_type, options.type, publicId));
        if (!found) throw { error: { http_code: 404 } };
        return found.resource;
      },
      async destroy(publicId, options) {
        destroyed.push(id(options.resource_type, options.type, publicId));
        objects.delete(id(options.resource_type, options.type, publicId));
        return { result: "ok" };
      },
      signRequest: (params, secret) => cloudinary.utils.api_sign_request(params, secret),
      async readHead(publicId, maxBytes) {
        if (failHead) throw new Error("read failed");
        const found = objects.get(id("raw", "private", publicId));
        if (!found) throw new Error("missing");
        return found.head.slice(0, maxBytes);
      },
    };

    return {
      client,
      destroyed,
      get resourceCalls() {
        return resourceCalls;
      },
      failLookups(status: number | null) {
        failLookups = status;
      },
      failHead(value: boolean) {
        failHead = value;
      },
      putImage(publicId: string, overrides: Record<string, unknown> = {}) {
        const format = (overrides.format as string) ?? "jpg";
        objects.set(id("image", "upload", publicId), {
          head: new Uint8Array(),
          resource: {
            public_id: publicId,
            resource_type: "image",
            type: "upload",
            format,
            bytes: 120_000,
            width: 1600,
            height: 1200,
            secure_url: `https://res.cloudinary.com/${CONFIG.cloudName}/image/upload/v1700000000/${publicId}.${format}`,
            ...overrides,
          },
        });
      },
      putRaw(publicId: string, head: Uint8Array, overrides: Record<string, unknown> = {}, type = "private") {
        objects.set(id("raw", type, publicId), {
          head,
          resource: { public_id: publicId, resource_type: "raw", type, bytes: 250_000, ...overrides },
        });
      },
      has: (resourceType: string, type: string, publicId: string) => objects.has(id(resourceType, type, publicId)),
    };
  }

  try {
    const [server] = await prisma.$queryRaw<{ addr: string | null }[]>`SELECT inet_server_addr()::text AS addr`;
    check("connected database server is local", server.addr === null || /^(127\.0\.0\.1|::1)(\/\d+)?$/.test(server.addr), String(server.addr));
    check("Cloudinary, Upstash and Gemini credentials are absent", REMOVED_CREDENTIALS.every((n) => process.env[n] === undefined));

    // -------------------------------------------------------------- content checks
    console.log("\nContent checks (shared by browser and server)");
    const match = types.digitalContentMatches;
    const pdf = makePdf(1);
    const multiPage = makePdf(12);
    check("valid PDF matches application/pdf", match(pdf, "application/pdf"));
    check("multi-page PDF matches application/pdf", match(multiPage, "application/pdf") && Buffer.from(multiPage).toString("latin1").includes("/Count 12"));
    check("PDF header after a short preamble still matches", match(text("\n\n%PDF-1.7\n"), "application/pdf"));
    check("Windows executable renamed .pdf is rejected", !match(bytes(0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00), "application/pdf"));
    check("ELF binary renamed .pdf is rejected", !match(bytes(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01), "application/pdf"));
    check("HTML renamed .pdf is rejected", !match(text("<!doctype html><script>alert(1)</script>"), "application/pdf"));
    check("PNG, JPEG, ZIP, MP4 and MP3 signatures match", match(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image/png") && match(bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg") && match(bytes(0x50, 0x4b, 0x03, 0x04), "application/zip") && match(bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70), "video/mp4") && match(text("ID3abc"), "audio/mpeg"));
    check("a PDF declared as PNG is rejected", !match(pdf, "image/png"));
    check("SVG must be text containing an svg element", match(text('<?xml version="1.0"?><svg xmlns="x">'), "image/svg+xml") && !match(bytes(0x3c, 0x73, 0x76, 0x67, 0x20, 0x00), "image/svg+xml"));
    check("text/plain rejects binary content", match(text("hello"), "text/plain") && !match(bytes(0x68, 0x00, 0x69), "text/plain"));
    check("undeclared or unknown types never match", !match(pdf, "") && !match(pdf, "application/x-msdownload"));
    check("empty content never matches", !match(new Uint8Array(), "application/pdf"));

    console.log("\nFilename safety");
    const nul = String.fromCharCode(0);
    const lf = String.fromCharCode(10);
    check("path segments are dropped", types.cleanDisplayFilename("../../etc/passwd") === "passwd" && types.cleanDisplayFilename("C:\\Users\\meemi\\My Pattern.pdf") === "My Pattern.pdf");
    check("control characters are removed", types.cleanDisplayFilename(`evil${nul}name${lf}.pdf`) === "evilname.pdf");
    check('"." and ".." fall back', types.cleanDisplayFilename("..") === "download" && types.cleanDisplayFilename("a/.") === "download");
    check("names are capped at 200 characters", types.cleanDisplayFilename(`${"a".repeat(300)}.pdf`).length === 200);
    const objectName = types.buildObjectName("../../../Secret Folder/My Pattern (Final).pdf");
    check("storage names from hostile filenames stay [a-z0-9-]", /^[a-z0-9-]+$/.test(objectName) && !objectName.includes("..") && objectName.includes("my-pattern-final-"), objectName);

    // -------------------------------------------------------------- storage: photos
    console.log("\nStorage: product photos");
    const now = 1_760_000_000_000;
    const cloud = fakeCloud();
    const storage = createAdminUploadStorage({ config: CONFIG, client: cloud.client, now: () => now });

    const signedImage = storage.signProductImage("My Holiday Photo 1.JPG");
    const imageFields = signedImage.fields;
    check("photo upload goes to this account's image endpoint", signedImage.uploadUrl === "https://api.cloudinary.com/v1_1/demo-cloud/image/upload");
    check(
      "photo fields are exactly the signed set plus signature and api_key",
      JSON.stringify(Object.keys(imageFields).sort()) === JSON.stringify(["allowed_formats", "api_key", "overwrite", "public_id", "signature", "timestamp", "transformation"]),
      JSON.stringify(Object.keys(imageFields)),
    );
    const { signature: imageSignature, api_key: _imageKey, ...imageSigned } = imageFields;
    void _imageKey;
    check("photo signature matches Cloudinary's algorithm over the sent fields", imageSignature === cloudinary.utils.api_sign_request(imageSigned, CONFIG.apiSecret));
    check("tampering with any signed field breaks the signature", imageSignature !== cloudinary.utils.api_sign_request({ ...imageSigned, public_id: "meemiart/other/evil" }, CONFIG.apiSecret) && imageSignature !== cloudinary.utils.api_sign_request({ ...imageSigned, allowed_formats: "jpg,png,webp,avif,svg" }, CONFIG.apiSecret));
    check("timestamp is fresh (the moment of signing)", imageFields.timestamp === String(Math.floor(now / 1000)));
    check("photo id is pinned inside the product folder, name slugified", /^meemiart\/products\/my-holiday-photo-1-[a-z0-9-]+$/.test(imageFields.public_id), imageFields.public_id);
    check("photo formats are limited to jpg, png, webp and avif", imageFields.allowed_formats === "jpg,png,webp,avif");
    check("photo keeps the relay's incoming transformation", imageFields.transformation === PRODUCT_IMAGE_TRANSFORMATION && PRODUCT_IMAGE_TRANSFORMATION === cloudinary.utils.generate_transformation_string([{ width: 2400, height: 2400, crop: "limit" }, { quality: "auto:good" }, { fetch_format: "auto" }]));
    check("overwrite is disabled, so a replay cannot swap a verified photo", imageFields.overwrite === "false");
    check("the API secret is never in the signed payload", !JSON.stringify(signedImage).includes(CONFIG.apiSecret));

    for (const format of ["jpg", "png", "webp"]) {
      const key = `meemiart/products/photo-${format}-abc123`;
      cloud.putImage(key, { format });
      const verified = await storage.verifyProductImage(key);
      check(`valid ${format.toUpperCase()} photo verifies with its CDN URL and dimensions`, verified.ok && verified.url === `https://res.cloudinary.com/demo-cloud/image/upload/v1700000000/${key}.${format}` && verified.width === 1600);
    }

    const lookupsBefore = cloud.resourceCalls;
    const outside = await storage.verifyProductImage("meemiart/digital-files/secret-file");
    const nested = await storage.verifyProductImage("meemiart/products/../digital-files/x");
    const video = await storage.verifyProductImage("meemiart/products/videos/clip-1");
    check("ids outside the product folder are refused without a lookup", !outside.ok && outside.reason === "invalid_key" && !nested.ok && !video.ok && cloud.resourceCalls === lookupsBefore);

    cloud.putImage("meemiart/products/animated-1", { format: "gif" });
    const gif = await storage.verifyProductImage("meemiart/products/animated-1");
    check("an unsupported stored format is rejected and destroyed", !gif.ok && gif.reason === "wrong_format" && cloud.destroyed.includes("image/upload/meemiart/products/animated-1"));

    cloud.putImage("meemiart/products/huge-1", { bytes: types.MAX_UPLOAD_BYTES + 1 });
    const huge = await storage.verifyProductImage("meemiart/products/huge-1");
    check("an oversized stored photo is rejected and destroyed", !huge.ok && huge.reason === "too_large" && cloud.destroyed.includes("image/upload/meemiart/products/huge-1"));

    cloud.putImage("meemiart/products/foreign-1", { secure_url: "https://evil.example.com/meemiart/products/foreign-1.jpg" });
    const foreignUrl = await storage.verifyProductImage("meemiart/products/foreign-1");
    check("a delivery URL that is not this account's CDN is rejected", !foreignUrl.ok && foreignUrl.reason === "wrong_type");

    const missing = await storage.verifyProductImage("meemiart/products/never-uploaded");
    check("a photo that never reached storage is not_found, and other endpoints are cleared", !missing.ok && missing.reason === "not_found" && cloud.destroyed.includes("raw/upload/meemiart/products/never-uploaded"));

    cloud.failLookups(500);
    cloud.putImage("meemiart/products/fine-1");
    const down = await storage.verifyProductImage("meemiart/products/fine-1");
    cloud.failLookups(null);
    check("storage outage is 'unavailable' and destroys nothing", !down.ok && down.reason === "unavailable" && !cloud.destroyed.includes("image/upload/meemiart/products/fine-1"));

    // -------------------------------------------------------------- storage: digital files
    console.log("\nStorage: digital files");
    const signedFile = storage.signDigitalFile("Mini Succulent Pattern (US Letter).pdf");
    const { signature: fileSignature, api_key: _fileKey, ...fileSigned } = signedFile.fields;
    void _fileKey;
    check("digital upload goes to the raw endpoint", signedFile.uploadUrl === "https://api.cloudinary.com/v1_1/demo-cloud/raw/upload");
    check("digital upload is signed as private", signedFile.fields.type === "private" && signedFile.fields.overwrite === "false");
    check("digital signature matches Cloudinary's algorithm", fileSignature === cloudinary.utils.api_sign_request(fileSigned, CONFIG.apiSecret));
    check("dropping 'private' breaks the signature", fileSignature !== cloudinary.utils.api_sign_request({ ...fileSigned, type: "upload" }, CONFIG.apiSecret));
    check("digital id is pinned inside the digital-files folder", /^meemiart\/digital-files\/mini-succulent-pattern-us-letter-[a-z0-9-]+$/.test(signedFile.fields.public_id), signedFile.fields.public_id);
    check("the API secret is never in the signed payload", !JSON.stringify(signedFile).includes(CONFIG.apiSecret));

    const pdfKey = "meemiart/digital-files/pattern-ok";
    cloud.putRaw(pdfKey, pdf);
    const goodPdf = await storage.verifyDigitalFile(pdfKey, "application/pdf");
    check("valid private PDF verifies", goodPdf.ok && goodPdf.bytes === 250_000);

    cloud.putRaw("meemiart/digital-files/multi", multiPage, { bytes: 6_000_000 });
    check("multi-page, 6 MB PDF verifies", (await storage.verifyDigitalFile("meemiart/digital-files/multi", "application/pdf")).ok);

    cloud.putRaw("meemiart/digital-files/renamed-exe", bytes(0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00));
    const exe = await storage.verifyDigitalFile("meemiart/digital-files/renamed-exe", "application/pdf");
    check("executable renamed .pdf is rejected and destroyed", !exe.ok && exe.reason === "wrong_content" && cloud.destroyed.includes("raw/private/meemiart/digital-files/renamed-exe"));

    cloud.putRaw("meemiart/digital-files/too-big", pdf, { bytes: types.MAX_DIGITAL_BYTES + 1 });
    const tooBig = await storage.verifyDigitalFile("meemiart/digital-files/too-big", "application/pdf");
    check("oversized digital file is rejected and destroyed", !tooBig.ok && tooBig.reason === "too_large" && cloud.destroyed.includes("raw/private/meemiart/digital-files/too-big"));

    cloud.putRaw("meemiart/digital-files/public-1", pdf, {}, "upload");
    const publicFile = await storage.verifyDigitalFile("meemiart/digital-files/public-1", "application/pdf");
    check("a publicly delivered upload is never accepted, and is cleared", !publicFile.ok && publicFile.reason === "not_found" && cloud.destroyed.includes("raw/upload/meemiart/digital-files/public-1"));

    cloud.putRaw("meemiart/digital-files/exe-type", pdf);
    const badType = await storage.verifyDigitalFile("meemiart/digital-files/exe-type", "application/x-msdownload");
    check("a declared type outside the allow-list is rejected", !badType.ok && badType.reason === "wrong_content");

    check("digital ids outside the folder are refused", !(await storage.verifyDigitalFile("meemiart/products/photo", "application/pdf")).ok && !storage.isDigitalFileKey("meemiart/digital-files/../products/x"));

    cloud.putRaw("meemiart/digital-files/unreadable", pdf);
    cloud.failHead(true);
    const unreadable = await storage.verifyDigitalFile("meemiart/digital-files/unreadable", "application/pdf");
    cloud.failHead(false);
    check("content that cannot be read is not accepted", !unreadable.ok && unreadable.reason === "unavailable");

    // ------------------------------------------------- folder configuration
    //
    // Regression: an empty CLOUDINARY_DIGITAL_FOLDER produced `public_id`
    // "/name", and Cloudinary refused every digital upload with
    // `400 public_id (/name) is invalid`. Photos were unaffected because they
    // read a different variable, which is why the admin could add images but
    // never a file. `?? default` does not catch a variable that exists and is
    // empty, so the folder is normalised instead.
    console.log("\nFolder configuration (regression)");
    const { normalizeFolder, DEFAULT_DIGITAL_FOLDER, DEFAULT_IMAGE_FOLDER } = uploadsStorage;
    check("an absent folder falls back to the default", normalizeFolder(undefined, DEFAULT_DIGITAL_FOLDER) === "meemiart/digital-files");
    check("an empty folder falls back to the default", normalizeFolder("", DEFAULT_DIGITAL_FOLDER) === "meemiart/digital-files");
    check("whitespace only falls back to the default", normalizeFolder("   ", DEFAULT_DIGITAL_FOLDER) === "meemiart/digital-files");
    check("leading and trailing slashes are dropped", normalizeFolder("/meemiart/digital-files/", DEFAULT_DIGITAL_FOLDER) === "meemiart/digital-files");
    check("repeated slashes are collapsed", normalizeFolder("meemiart//digital-files", DEFAULT_DIGITAL_FOLDER) === "meemiart/digital-files");
    check("backslashes are treated as separators", normalizeFolder("meemiart\\digital-files", DEFAULT_DIGITAL_FOLDER) === "meemiart/digital-files");
    check("a usable folder is left alone", normalizeFolder("shop/files", DEFAULT_DIGITAL_FOLDER) === "shop/files");
    check(
      "photos and files keep their own separate defaults",
      DEFAULT_IMAGE_FOLDER === "meemiart/products" &&
        DEFAULT_DIGITAL_FOLDER === "meemiart/digital-files" &&
        normalizeFolder("", DEFAULT_IMAGE_FOLDER) !== normalizeFolder("", DEFAULT_DIGITAL_FOLDER),
    );

    // Cloudinary refuses an id that is rooted at a slash or holds an empty
    // segment, so no configured value may produce one.
    const validPublicId = (id: string) => /^[a-z0-9][a-z0-9/-]*$/.test(id) && !id.includes("//") && !id.startsWith("/") && !id.endsWith("/");
    for (const folder of ["", "   ", "/meemiart/digital-files/", "meemiart//digital-files", "meemiart\\digital-files", "shop/files"]) {
      const storageForFolder = createAdminUploadStorage({
        config: { ...CONFIG, imageFolder: folder, digitalFolder: folder },
        client: cloud.client,
      });
      const digitalId = storageForFolder.signDigitalFile("Pattern (US Letter).pdf").fields.public_id;
      const imageId = storageForFolder.signProductImage("Photo.jpg").fields.public_id;
      const label = folder === "" ? "(empty)" : folder === "   " ? "(whitespace)" : folder;
      check(
        `folder ${label} signs an id Cloudinary accepts, for both kinds`,
        validPublicId(digitalId) && validPublicId(imageId),
        `${digitalId} | ${imageId}`,
      );
      check(
        `folder ${label} signs an id its own verification accepts`,
        storageForFolder.isDigitalFileKey(digitalId) && storageForFolder.isProductImageKey(imageId),
        digitalId,
      );
      // The signature has to cover the id actually sent, normalised or not.
      const { signature, api_key: _k, ...signedFields } = storageForFolder.signDigitalFile("Pattern.pdf").fields;
      void _k;
      check(
        `folder ${label} signs exactly the fields it sends`,
        signature === cloudinary.utils.api_sign_request(signedFields, CONFIG.apiSecret) && signedFields.type === "private",
      );
    }

    // ------------------------------------------------- reading the stored head
    //
    // Regression: this read used to open the response as a stream, take the
    // first chunk and cancel the rest. Against a private Cloudinary download
    // the cancel did not return for over two minutes and poisoned the
    // connection pool, so finalizing an upload ran past the platform's function
    // timeout and every upload of a good PDF reported "PDF upload failed".
    console.log("\nReading the stored head (regression)");
    const headOf = (body: Uint8Array, status = 206, extra: Partial<Response> = {}) =>
      ({
        ok: status >= 200 && status < 300,
        status,
        arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        ...extra,
      }) as unknown as Response;

    // A body comfortably larger than the sniff window, opening like a PDF.
    const longPdf = new Uint8Array(4096).fill(0x20);
    longPdf.set(pdf.subarray(0, Math.min(pdf.length, 64)), 0);

    let lastInit: RequestInit | undefined;
    const rangeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      lastInit = init;
      return headOf(longPdf.subarray(0, types.CONTENT_SNIFF_BYTES));
    }) as unknown as typeof fetch;

    const head = await uploadsStorage.readStorageHead("https://storage.invalid/x", types.CONTENT_SNIFF_BYTES, rangeFetch);
    const rangeHeader = new Headers(lastInit?.headers).get("range");
    check("the head read asks for only the sniff window", rangeHeader === `bytes=0-${types.CONTENT_SNIFF_BYTES - 1}`, String(rangeHeader));
    check("a 206 partial response is read whole", head.length === types.CONTENT_SNIFF_BYTES && head[0] === 0x25 && head[1] === 0x50, `${head.length} bytes`);
    check("the head read never streams, so nothing has to be cancelled", lastInit?.signal instanceof AbortSignal && !("cancelled" in (lastInit ?? {})));

    // A server that ignores Range answers 200 with the whole object.
    const fullFetch = (async () => headOf(longPdf, 200)) as unknown as typeof fetch;
    const sliced = await uploadsStorage.readStorageHead("https://storage.invalid/x", types.CONTENT_SNIFF_BYTES, fullFetch);
    check("a server that ignores Range is still bounded to the sniff window", sliced.length === types.CONTENT_SNIFF_BYTES);

    // The old code would hang here: it cancelled a stream that never settles.
    const hangingBody = {
      getReader: () => ({
        read: async () => ({ done: false, value: longPdf.subarray(0, 512) }),
        cancel: () => new Promise<void>(() => {}),
      }),
    };
    const hangingCancelFetch = (async () =>
      headOf(longPdf.subarray(0, types.CONTENT_SNIFF_BYTES), 206, { body: hangingBody } as unknown as Partial<Response>)) as unknown as typeof fetch;
    const raced = await Promise.race([
      uploadsStorage.readStorageHead("https://storage.invalid/x", types.CONTENT_SNIFF_BYTES, hangingCancelFetch).then(() => "read"),
      new Promise((resolve) => setTimeout(() => resolve("hung"), 2_000)),
    ]);
    check("a body whose cancel never settles no longer blocks the read", raced === "read");

    let threw = "";
    await uploadsStorage
      .readStorageHead("https://storage.invalid/x", types.CONTENT_SNIFF_BYTES, (async () => headOf(longPdf, 404)) as unknown as typeof fetch)
      .catch((error: Error) => { threw = error.message; });
    check("an error status is surfaced, not treated as content", threw.includes("404"), threw);

    // Storage that never answers must fail fast, not hang the request.
    const startedAt = Date.now();
    let timedOut = false;
    const stalling = ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;
    await uploadsStorage
      .readStorageHead("https://storage.invalid/x", types.CONTENT_SNIFF_BYTES, stalling, 300)
      .catch(() => { timedOut = true; });
    check("storage that never answers aborts on its own timeout", timedOut && Date.now() - startedAt < 2_000, `${Date.now() - startedAt}ms`);
    check("the production timeout is bounded well under a serverless limit", uploadsStorage.STORAGE_READ_TIMEOUT_MS <= 10_000);

    const unconfigured = createAdminUploadStorage({ config: null, client: cloud.client });
    check("unconfigured storage reports so and signs nothing", !unconfigured.isConfigured && (() => { try { unconfigured.signDigitalFile("x.pdf"); return false; } catch { return true; } })());

    // -------------------------------------------------------------- authorization and routes
    console.log("\nAuthorization and route guards");
    const admin = async () => ({ id: "admin-user" });
    const signedOut = async () => null;
    // `getAdminOrNull` answers null for a signed-in customer (and re-reads the
    // role from the database); this models that answer.
    const customer = async () => null;
    const base: Partial<ProductUploadDeps> = { storage, currentAdmin: admin };

    for (const [label, currentAdmin] of [["unauthenticated", signedOut], ["non-admin", customer]] as const) {
      const lookups = cloud.resourceCalls;
      const results = await Promise.all([
        uploads.signProductImageUpload({ filename: "a.jpg", type: "image/jpeg", size: 10 }, { ...base, currentAdmin }),
        uploads.finalizeProductImageUpload({ key: "meemiart/products/photo-jpg-abc123" }, { ...base, currentAdmin }),
        uploads.signDigitalFileUpload({ productId: "x", filename: "a.pdf", type: "application/pdf", size: 10 }, { ...base, currentAdmin }),
        uploads.finalizeDigitalFileUpload({ productId: "x", key: pdfKey, filename: "a.pdf", type: "application/pdf" }, { ...base, currentAdmin }),
      ]);
      check(`${label}: every step is refused with 404 and touches no storage`, results.every((r) => !r.ok && r.status === 404) && cloud.resourceCalls === lookups);
      check(`${label}: no signature is issued`, !JSON.stringify(results).includes("signature"));
    }

    const post = (route: { POST: (request: Request) => Promise<Response> }, headers: Record<string, string>, body: string) =>
      route.POST(new Request("http://localhost:3000/api/admin/x", { method: "POST", headers: { host: "localhost:3000", "content-type": "application/json", ...headers }, body }));
    const crossSite = await post(digitalRoute, { origin: "https://evil.example.com" }, JSON.stringify({ step: "sign" }));
    const noOrigin = await post(digitalRoute, {}, JSON.stringify({ step: "sign" }));
    check("cross-site and origin-less JSON steps are refused before auth", crossSite.status === 403 && noOrigin.status === 403);
    const bigBody = await post(digitalRoute, { origin: "http://localhost:3000" }, JSON.stringify({ step: "sign", filename: "x".repeat(5000) }));
    check("oversized step bodies are refused", bigBody.status === 413);

    // -------------------------------------------------------------- photo steps
    console.log("\nPhoto upload steps (admin)");
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      const signed = await uploads.signProductImageUpload({ filename: "Front View.jpg", type, size: 3_000_000 }, base);
      check(`${type} is signed for a direct upload`, signed.ok && signed.data.mode === "direct" && "fields" in signed.data && signed.data.fields.public_id.startsWith("meemiart/products/"));
    }
    const largeImage = await uploads.signProductImageUpload({ filename: "big.jpg", type: "image/jpeg", size: 7_500_000 }, base);
    check("a 7.5 MB photo (over the old 4.5 MB relay limit) is signed", largeImage.ok);
    const gifSign = await uploads.signProductImageUpload({ filename: "a.gif", type: "image/gif", size: 100 }, base);
    const pdfAsImage = await uploads.signProductImageUpload({ filename: "a.pdf", type: "application/pdf", size: 100 }, base);
    check("invalid image MIME types are refused with a clear message", !gifSign.ok && gifSign.status === 415 && gifSign.error === "Only JPEG, PNG, WebP and AVIF images are supported." && !pdfAsImage.ok);
    const bigSign = await uploads.signProductImageUpload({ filename: "a.jpg", type: "image/jpeg", size: types.MAX_UPLOAD_BYTES + 1 }, base);
    check("oversized photos are refused with 413", !bigSign.ok && bigSign.status === 413 && /8 MB/.test(bigSign.error));
    const emptySign = await uploads.signProductImageUpload({ filename: "a.jpg", type: "image/jpeg", size: 0 }, base);
    check("empty photos are refused", !emptySign.ok && emptySign.status === 400);
    const relay = await uploads.signProductImageUpload({ filename: "a.jpg", type: "image/jpeg", size: 100 }, { ...base, storage: unconfigured });
    check("without Cloudinary, photos fall back to the local relay", relay.ok && relay.data.mode === "relay");

    const finalized = await uploads.finalizeProductImageUpload({ key: "meemiart/products/photo-png-abc123" }, base);
    check("finalize returns the verified URL and key for the product form", finalized.ok && finalized.data.url.endsWith("/meemiart/products/photo-png-abc123.png") && finalized.data.key === "meemiart/products/photo-png-abc123");
    const failedStorage = await uploads.finalizeProductImageUpload({ key: "meemiart/products/not-there" }, base);
    check("failed storage upload: a clear retry message, not success", !failedStorage.ok && failedStorage.status === 422 && failedStorage.error === "The image didn't reach storage. Please try again.");
    cloud.failLookups(503);
    const outage = await uploads.finalizeProductImageUpload({ key: "meemiart/products/photo-jpg-abc123" }, base);
    cloud.failLookups(null);
    check("storage outage: 502 with a safe message", !outage.ok && outage.status === 502 && !/503|http_code/.test(outage.error));

    // -------------------------------------------------------------- digital steps with the local database
    console.log("\nDigital file steps (admin, local database)");
    const category = await prisma.category.create({ data: { name: "Upload fixtures", slug: RUN, isActive: false, sortOrder: 9999 } });
    createdCategories.push(category.id);
    const makeProduct = (suffix: string) =>
      prisma.product.create({
        data: { name: `Upload fixture ${suffix}`, slug: `${RUN}-${suffix}`, sku: `${RUN}-${suffix}`, brand: "Meemi Art", description: "Upload harness fixture.", priceCents: 300, categoryId: category.id, isActive: false },
        select: { id: true },
      });
    const product = await makeProduct("main");
    const other = await makeProduct("other");

    const removedPrevious: string[] = [];
    const digitalDeps: Partial<ProductUploadDeps> = { ...base, removePreviousFile: async (key) => void removedPrevious.push(key) };

    const signPdf = await uploads.signDigitalFileUpload({ productId: product.id, filename: "My Pattern.pdf", type: "application/pdf", size: 6_000_000 }, digitalDeps);
    check("a 6 MB PDF (over the old relay limit) is signed for a private raw upload", signPdf.ok && signPdf.data.uploadUrl.endsWith("/raw/upload") && signPdf.data.fields.type === "private");
    const signMissing = await uploads.signDigitalFileUpload({ productId: "no-such-product", filename: "a.pdf", type: "application/pdf", size: 100 }, digitalDeps);
    check("signing for a product that does not exist is refused", !signMissing.ok && signMissing.status === 404);
    const signExe = await uploads.signDigitalFileUpload({ productId: product.id, filename: "a.exe", type: "application/x-msdownload", size: 100 }, digitalDeps);
    check("a non-allowed type is refused before signing", !signExe.ok && signExe.status === 415);
    const signHuge = await uploads.signDigitalFileUpload({ productId: product.id, filename: "a.pdf", type: "application/pdf", size: types.MAX_DIGITAL_BYTES + 1 }, digitalDeps);
    check("an oversized PDF is refused with the too-large message", !signHuge.ok && signHuge.status === 413 && signHuge.error.startsWith("PDF upload failed because the file is too large."));

    const firstKey = "meemiart/digital-files/first-upload";
    cloud.putRaw(firstKey, pdf, { bytes: 4_321 });
    const first = await uploads.finalizeDigitalFileUpload({ productId: product.id, key: firstKey, filename: "../../My Pattern.pdf", type: "application/pdf" }, digitalDeps);
    const row1 = await prisma.digitalAsset.findUnique({ where: { productId: product.id } });
    check("successful persistence writes the DigitalAsset row the download route reads", first.ok && row1?.storageKey === firstKey && row1.contentType === "application/pdf" && row1.bytes === 4_321);
    check("the stored filename is display-safe (no path)", row1?.filename === "My Pattern.pdf");
    check("the response carries no storage key and no secret", first.ok && !JSON.stringify(first).includes(firstKey) && !JSON.stringify(first).includes(CONFIG.apiSecret));

    const secondKey = "meemiart/digital-files/second-upload";
    cloud.putRaw(secondKey, multiPage, { bytes: 9_999 });
    const second = await uploads.finalizeDigitalFileUpload({ productId: product.id, key: secondKey, filename: "Pattern v2.pdf", type: "application/pdf" }, digitalDeps);
    const row2 = await prisma.digitalAsset.findUnique({ where: { productId: product.id } });
    check("replacing the PDF updates the row and removes the old file", second.ok && row2?.storageKey === secondKey && row2.filename === "Pattern v2.pdf" && removedPrevious.includes(firstKey));

    const exeKey = "meemiart/digital-files/renamed-exe-2";
    cloud.putRaw(exeKey, bytes(0x4d, 0x5a, 0x90, 0x00, 0x03));
    const exeResult = await uploads.finalizeDigitalFileUpload({ productId: product.id, key: exeKey, filename: "pattern.pdf", type: "application/pdf" }, digitalDeps);
    const row3 = await prisma.digitalAsset.findUnique({ where: { productId: product.id } });
    check("renamed non-PDF: refused with the PDF message, destroyed, product keeps its file", !exeResult.ok && exeResult.status === 415 && exeResult.error.startsWith("That file isn't a valid PDF.") && cloud.destroyed.includes(`raw/private/${exeKey}`) && row3?.storageKey === secondKey);

    const failedKey = "meemiart/digital-files/never-arrived";
    const notArrived = await uploads.finalizeDigitalFileUpload({ productId: product.id, key: failedKey, filename: "a.pdf", type: "application/pdf" }, digitalDeps);
    check("failed storage upload: 422 retry message, row unchanged", !notArrived.ok && notArrived.status === 422 && (await prisma.digitalAsset.findUnique({ where: { productId: product.id } }))?.storageKey === secondKey);

    const dbFailKey = "meemiart/digital-files/db-fails";
    cloud.putRaw(dbFailKey, pdf);
    const removedBefore = removedPrevious.length;
    const failingDb = {
      product: prisma.product,
      digitalAsset: new Proxy(prisma.digitalAsset, {
        get(target, property, receiver) {
          if (property === "upsert") {
            return async () => {
              throw new Error("connect ECONNREFUSED postgresql://admin:hunter2@db.internal:5432/prod");
            };
          }
          return Reflect.get(target, property, receiver);
        },
      }),
    } as unknown as ProductUploadDeps["db"];
    const logged: string[] = [];
    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
    console.warn = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
    let dbFailure: Awaited<ReturnType<typeof uploads.finalizeDigitalFileUpload>>;
    try {
      dbFailure = await uploads.finalizeDigitalFileUpload({ productId: product.id, key: dbFailKey, filename: "a.pdf", type: "application/pdf" }, { ...digitalDeps, db: failingDb });
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }
    check("failed database persistence: not reported as success", !dbFailure.ok && dbFailure.status === 500 && dbFailure.error === "The file uploaded, but it couldn't be saved to the product. Please try again.");
    check("failed database persistence: new object discarded, old file kept and not removed", cloud.destroyed.includes(`raw/private/${dbFailKey}`) && removedPrevious.length === removedBefore && (await prisma.digitalAsset.findUnique({ where: { productId: product.id } }))?.storageKey === secondKey);
    check("failure details never reach the response or the log", !/hunter2|ECONNREFUSED|db\.internal/.test(JSON.stringify(dbFailure) + logged.join("\n")));

    const claimed = await uploads.finalizeDigitalFileUpload({ productId: other.id, key: secondKey, filename: "steal.pdf", type: "application/pdf" }, digitalDeps);
    check("another product's stored file cannot be claimed, and is not destroyed", !claimed.ok && claimed.status === 409 && !cloud.destroyed.includes(`raw/private/${secondKey}`) && cloud.has("raw", "private", secondKey));

    const goneKey = "meemiart/digital-files/for-missing-product";
    cloud.putRaw(goneKey, pdf);
    const gone = await uploads.finalizeDigitalFileUpload({ productId: "no-such-product", key: goneKey, filename: "a.pdf", type: "application/pdf" }, digitalDeps);
    check("finalizing for a deleted product: 404 and the upload is discarded", !gone.ok && gone.status === 404 && cloud.destroyed.includes(`raw/private/${goneKey}`));

    const traversalKey = await uploads.finalizeDigitalFileUpload({ productId: product.id, key: "meemiart/digital-files/../products/photo", filename: "a.pdf", type: "application/pdf" }, digitalDeps);
    check("path-traversal storage keys are refused", !traversalKey.ok && traversalKey.status === 400);

    // -------------------------------------------------------------- download authorization unchanged
    // ------------------------------------------------- publishing needs a file
    //
    // The update path has always refused to publish a product with no file.
    // The create path did not, so a product could be created already published
    // with nothing to deliver — and one such product exists in production. A
    // new product cannot have a file yet (the upload targets a saved product),
    // so creating one published is refused outright.
    //
    // Checked in source: `createProduct` reaches for the session before any of
    // this, which a harness outside a request cannot provide.
    console.log("\nPublishing requires a file (regression)");
    const productActions = readFileSync(path.resolve(__dirname, "..", "src/lib/actions/admin/products.ts"), "utf8");
    const createBody = productActions.slice(
      productActions.indexOf("export async function createProduct"),
      productActions.indexOf("export async function updateProduct"),
    );
    check("the create path has a published-without-a-file guard", /if \(data\.isActive\) \{/.test(createBody));
    check(
      "it refuses before the product row is written",
      createBody.indexOf("if (data.isActive) {") > 0 &&
        createBody.indexOf("if (data.isActive) {") < createBody.indexOf("prisma.product.create"),
    );
    check(
      "it names the same rule the update path states",
      /A published product must have a file to deliver\./.test(createBody),
    );
    check(
      "the update path's own guard is untouched",
      /if \(data\.isActive && !existing\.asset\) \{/.test(productActions),
    );
    check(
      "neither path silently publishes instead of refusing",
      !/isActive: false,\s*\/\/ forced/.test(productActions) && /ok: false/.test(createBody),
    );

    console.log("\nDownload authorization (unchanged)");
    const buyer = await prisma.user.create({ data: { email: `${RUN}-buyer@example.test`, name: "Buyer" }, select: { id: true } });
    const stranger = await prisma.user.create({ data: { email: `${RUN}-stranger@example.test`, name: "Stranger" }, select: { id: true } });
    const unpaid = await prisma.user.create({ data: { email: `${RUN}-unpaid@example.test`, name: "Unpaid" }, select: { id: true } });
    createdUsers.push(buyer.id, stranger.id, unpaid.id);

    const grant = async (userId: string, status: "COMPLETED" | "PENDING", paymentStatus: "PAID" | "PENDING") => {
      const order = await prisma.order.create({
        data: {
          orderNumber: `${RUN}-${userId.slice(-6)}`, userId, status, email: "x@example.test", customerName: "X", subtotalCents: 300, totalCents: 300,
          payment: { create: { status: paymentStatus, amountCents: 300, provider: "sandbox" } },
          items: { create: { productId: product.id, name: "Upload fixture", slug: `${RUN}-main`, sku: `${RUN}-main`, unitPriceCents: 300, quantity: 1, totalCents: 300 } },
        },
        select: { id: true, items: { select: { id: true } } },
      });
      await prisma.digitalAccess.create({ data: { userId, orderId: order.id, orderItemId: order.items[0].id, productId: product.id } });
    };
    await grant(buyer.id, "COMPLETED", "PAID");
    await grant(unpaid.id, "PENDING", "PENDING");

    const buyerAccess = await findDownloadableAsset(buyer.id, product.id);
    check("paid, completed buyer resolves the uploaded file", buyerAccess?.storageKey === secondKey && buyerAccess.filename === "Pattern v2.pdf" && buyerAccess.contentType === "application/pdf");
    check("a user with no purchase gets nothing", (await findDownloadableAsset(stranger.id, product.id)) === null);
    check("an unpaid, incomplete order gets nothing", (await findDownloadableAsset(unpaid.id, product.id)) === null);
  } finally {
    if (createdUsers.length > 0) await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    if (createdCategories.length > 0) {
      await prisma.product.deleteMany({ where: { categoryId: { in: createdCategories } } });
      await prisma.category.deleteMany({ where: { id: { in: createdCategories } } });
    }
    const leftovers =
      (await prisma.product.count({ where: { slug: { startsWith: RUN } } })) +
      (await prisma.category.count({ where: { slug: RUN } })) +
      (await prisma.user.count({ where: { email: { startsWith: RUN } } })) +
      (await prisma.order.count({ where: { orderNumber: { startsWith: RUN } } })) +
      (await prisma.digitalAsset.count({ where: { product: { slug: { startsWith: RUN } } } }));
    check("fixtures removed (products, assets, users, orders, access)", leftovers === 0, String(leftovers));
    check("no outbound network request was attempted", outbound === 0, String(outbound));
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error("\nHarness crashed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  });
