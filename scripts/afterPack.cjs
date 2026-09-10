/**
 * electron-builder afterPack hook (win32):
 * Injects the app icon + version metadata straight into the packed exe
 * using `resedit` (pure JS PE editor) — replaces the wine-dependent
 * rcedit step which is impossible on this build host.
 */
const fs = require("node:fs");
const path = require("node:path");
const { NtExecutable, NtExecutableResource, Data, Resource } = require("resedit");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const appInfo = context.packager.appInfo;
  const exeName = `${appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(context.packager.buildResourcesDir, "icon.ico");

  if (!fs.existsSync(exePath)) throw new Error(`afterPack: exe not found: ${exePath}`);
  if (!fs.existsSync(iconPath)) throw new Error(`afterPack: icon not found: ${iconPath}`);

  const iconFile = Data.IconFile.from(fs.readFileSync(iconPath));
  const pe = NtExecutable.from(fs.readFileSync(exePath));
  const res = NtExecutableResource.from(pe);

  // ── icon: replace the first existing icon group (electron ships group id 1) ──
  const groups = Resource.IconGroupEntry.fromEntries(res.entries);
  const groupId = groups.length > 0 ? groups[0].id : 1;
  const groupLang = groups.length > 0 ? groups[0].lang : 1033;
  Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    groupId,
    groupLang,
    iconFile.icons.map((i) => i.data)
  );

  // ── version info ──
  const v = `${appInfo.version}.0`; // x.x.x.0 quads required
  const vi = Resource.VersionInfo.createEmpty();
  vi.setFileVersion(v, 1033);
  vi.setProductVersion(v, 1033);
  vi.setStringValues(
    { lang: 1033, charset: 1200 },
    {
      CompanyName: "STAG",
      FileDescription: "STAG — DNS health checker for gamers",
      FileVersion: v,
      InternalName: "stag",
      LegalCopyright: "MIT License",
      OriginalFilename: exeName,
      ProductName: "STAG",
      ProductVersion: v,
    },
    true
  );
  vi.outputToResourceEntries(res.entries);

  res.outputResource(pe);
  fs.writeFileSync(exePath, Buffer.from(pe.generate()));
  console.log(`  • afterPack(resedit): icon(group ${groupId}) + version ${v} injected into ${exeName}`);
};
